/**
 * EndpointRouter - Endpoint pool routing with automatic fallback
 * 
 * Responsibilities:
 *   1. Load endpoint pools from platform config (xhs_endpoints.json)
 *   2. Try endpoints in priority order
 *   3. Automatically fallback to next endpoint on failure
 *   4. Cache dead endpoints to avoid repeated failures
 *   5. Normalize response data via adapters
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// HTTP status codes that trigger fallback (try next endpoint)
const DEGRADABLE_CODES = new Set([400, 404, 500, 502, 503, 504]);

// HTTP status codes that should NOT trigger fallback (no point trying other endpoints)
const NON_DEGRADABLE_CODES = new Set([401, 402]);

// Pool category mapping for XHS
const XHS_POOL_CATEGORIES: Record<string, string> = {
  search_notes: 'search',
  search_users: 'search',
  fetch_user_info: 'user',
  fetch_user_notes: 'user',
  fetch_note_detail_image: 'detail',
  fetch_note_detail_video: 'detail',
  fetch_note_comments: 'comments',
};

interface EndpointConfig {
  group: string;
  path: string;
  method?: string;
  params: Record<string, string>;
  adapter: string;
  _note?: string;
}

interface EndpointsFile {
  platform: string;
  version: string;
  pools: Record<string, EndpointConfig[]>;
}

interface RequestFunction {
  (method: string, path: string, params: Record<string, string>, retries?: number, delay?: number): Promise<any>;
}

export class TikHubError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TikHubError';
  }
}

/**
 * EndpointRouter - manages endpoint pools and automatic fallback
 */
export class EndpointRouter {
  private pools: Record<string, EndpointConfig[]>;
  private deadEndpoints: Map<string, boolean> = new Map(); // "group:path" -> true
  private deadCategoryGroups: Map<string, boolean> = new Map(); // "category:group" -> true
  private softFailCounts: Map<string, number> = new Map(); // "group:path" -> count
  private http400Counts: Map<string, number> = new Map(); // "group:path" -> count
  private poolCategories: Record<string, string>;
  private requestFunc: RequestFunction;
  private platform: string;

  constructor(requestFunc: RequestFunction, platform: string = 'xhs', configPath?: string) {
    this.requestFunc = requestFunc;
    this.platform = platform.toLowerCase();
    this.poolCategories = platform === 'xhs' ? XHS_POOL_CATEGORIES : {};
    
    // Load endpoint configuration
    const actualPath = configPath || join(__dirname, `${this.platform}_endpoints.json`);
    this.pools = this.loadConfig(actualPath);
  }

  /**
   * Load and validate endpoints.json
   */
  private loadConfig(path: string): Record<string, EndpointConfig[]> {
    try {
      const content = readFileSync(path, 'utf-8');
      const config: EndpointsFile = JSON.parse(content);
      
      if (!config.pools || Object.keys(config.pools).length === 0) {
        throw new Error('Endpoint config file has empty pools');
      }

      // Validate required fields
      const requiredFields = ['group', 'path', 'params', 'adapter'];
      for (const [poolName, endpoints] of Object.entries(config.pools)) {
        if (!Array.isArray(endpoints) || endpoints.length === 0) {
          throw new Error(`Pool '${poolName}' must be a non-empty array`);
        }
        
        for (let i = 0; i < endpoints.length; i++) {
          const ep = endpoints[i];
          const missing = requiredFields.filter(field => !(field in ep));
          if (missing.length > 0) {
            throw new Error(`Pool '${poolName}'[${i}] missing fields: ${missing.join(', ')}`);
          }
        }
      }

      return config.pools;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Endpoint config file not found: ${path}`);
      }
      throw error;
    }
  }

  /**
   * Render parameter template: replace '${key}' with args[key]
   */
  private renderParams(template: Record<string, string>, args: Record<string, any>): Record<string, string> {
    const rendered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const argKey = value.slice(2, -1);
        const argVal = args[argKey];
        
        // Skip if caller didn't provide this parameter
        if (argVal !== undefined && argVal !== null && argVal !== '') {
          rendered[key] = String(argVal);
        }
      } else {
        // Static value (e.g., "sort": "general")
        rendered[key] = value;
      }
    }
    
    return rendered;
  }

  /**
   * Generate unique endpoint identifier
   */
  private epKey(ep: EndpointConfig): string {
    return `${ep.group}:${ep.path}`;
  }

  /**
   * Check if endpoint is in dead cache (exact match or category-level)
   */
  private isDead(ep: EndpointConfig, poolName: string): boolean {
    // Check exact match
    if (this.deadEndpoints.get(this.epKey(ep))) {
      return true;
    }
    
    // Check category-level dead cache
    const category = this.poolCategories[poolName] || poolName;
    const catKey = `${category}:${ep.group}`;
    if (this.deadCategoryGroups.get(catKey)) {
      return true;
    }
    
    return false;
  }

  /**
   * Mark endpoint as dead (both exact and category-level)
   */
  private markDead(ep: EndpointConfig, reason: string, poolName: string): void {
    const key = this.epKey(ep);
    this.deadEndpoints.set(key, true);
    
    // Mark category-level dead
    const category = this.poolCategories[poolName] || poolName;
    const catKey = `${category}:${ep.group}`;
    this.deadCategoryGroups.set(catKey, true);
    
    console.log(`  ⛔ Marked dead: [${ep.group}] ${ep.path} (${reason}) [category:${category}]`);
  }

  /**
   * Mark soft failure (HTTP 200 but empty data)
   */
  private markSoftFail(ep: EndpointConfig, poolName: string): void {
    const key = this.epKey(ep);
    const count = (this.softFailCounts.get(key) || 0) + 1;
    this.softFailCounts.set(key, count);
    
    // Comments endpoints have higher threshold (empty comments are normal)
    const category = this.poolCategories[poolName] || poolName;
    const threshold = category === 'comments' ? 5 : 2;
    
    if (count >= threshold) {
      this.markDead(ep, 'consecutive empty data', poolName);
    }
  }

  /**
   * Check if response data is empty
   */
  private isEmpty(data: any): boolean {
    if (!data || typeof data !== 'object') return true;
    
    // Check common data containers
    const containers = [
      data.data?.data,
      data.data,
      data.items,
      data.notes,
      data.feeds,
      data.list,
    ];
    
    for (const container of containers) {
      if (Array.isArray(container)) {
        return container.length === 0;
      }
      if (container && typeof container === 'object' && Object.keys(container).length > 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Call API with automatic endpoint fallback
   * 
   * @param poolName - Pool name (e.g., "search_notes")
   * @param args - Call parameters (e.g., {keyword: "xxx", page: 1})
   * @param retries - Retry count per endpoint
   * @param delay - Retry delay in ms
   * @param skipEndpoints - Endpoint identifiers to skip (for retry logic)
   * @returns Normalized response with _endpoint_used and _endpoint_group metadata
   */
  async call(
    poolName: string,
    args: Record<string, any>,
    retries: number = 1,
    delay: number = 2000,
    skipEndpoints: string[] = []
  ): Promise<any> {
    const pool = this.pools[poolName];
    if (!pool) {
      throw new TikHubError(`Unknown endpoint pool: ${poolName}`);
    }

    const skipSet = new Set(skipEndpoints);
    const errors: string[] = [];
    let actuallyTried = 0;

    for (let i = 0; i < pool.length; i++) {
      const ep = pool[i];
      
      // Skip dead endpoints
      if (this.isDead(ep, poolName)) {
        continue;
      }

      // Skip endpoints from previous attempts (for retry logic)
      if (skipSet.has(this.epKey(ep))) {
        continue;
      }

      // Render parameters
      const params = this.renderParams(ep.params, args);
      const method = ep.method || 'GET';
      const groupTag = `[${ep.group}]`;

      if (actuallyTried > 0) {
        console.log(`  🔄 Falling back to ${groupTag} ${ep.path}`);
      }
      actuallyTried++;

      try {
        const raw = await this.requestFunc(method, ep.path, params, retries, delay);
        
        // Check for "fake success" (HTTP 200 but empty data)
        if (this.isEmpty(raw)) {
          // Comments endpoint special handling: HTTP 200 + empty = normal (note has no comments)
          const category = this.poolCategories[poolName] || poolName;
          if (category === 'comments') {
            return {
              ...raw,
              _endpoint_used: this.epKey(ep),
              _endpoint_group: ep.group,
            };
          }
          
          this.markSoftFail(ep, poolName);
          errors.push(`${groupTag} returned empty data`);
          continue;
        }

        // Success! Print message if this was a fallback
        if (actuallyTried > 1) {
          console.log(`  ✅ ${groupTag} fallback succeeded`);
        }

        // Reset HTTP 400 count on success
        this.http400Counts.set(this.epKey(ep), 0);

        // Inject endpoint metadata (for retry logic to skip used endpoints)
        return {
          ...raw,
          _endpoint_used: this.epKey(ep),
          _endpoint_group: ep.group,
        };

      } catch (error: any) {
        const statusCode = error.statusCode || error.status;

        // Non-degradable errors: API key invalid or insufficient balance
        if (statusCode && NON_DEGRADABLE_CODES.has(statusCode)) {
          throw error;
        }

        // 403: Single endpoint permission denied
        if (statusCode === 403) {
          this.deadEndpoints.set(this.epKey(ep), true);
          errors.push(`${groupTag} HTTP 403 (endpoint permission denied, skipping)`);
          continue;
        }

        // 429: Rate limiting
        if (statusCode === 429) {
          errors.push(`${groupTag} rate limited (429)`);
          continue;
        }

        // 422: Endpoint path valid but content restricted or params rejected
        if (statusCode === 422) {
          errors.push(`${groupTag} HTTP 422 (content restricted/params rejected)`);
          continue;
        }

        // Degradable errors or unknown errors
        if (!statusCode || DEGRADABLE_CODES.has(statusCode)) {
          if (statusCode === 400) {
            // 400 might be single note restricted (private/deleted), don't immediately mark dead
            // Only mark dead after 3 consecutive 400s, and only mark individual endpoint
            const epKey = this.epKey(ep);
            const count = (this.http400Counts.get(epKey) || 0) + 1;
            this.http400Counts.set(epKey, count);
            
            if (count >= 3) {
              this.deadEndpoints.set(epKey, true);
              console.log(`  ⛔ Marked dead: [${ep.group}] ${ep.path} (consecutive ${count} HTTP 400)`);
            }
            errors.push(`${groupTag} HTTP 400 (attempt ${count})`);
          } else {
            // 500/502/503/504/404: Endpoint really down, mark dead immediately
            const reason = statusCode ? `HTTP ${statusCode}` : String(error.message || error).slice(0, 60);
            this.markDead(ep, reason, poolName);
            errors.push(`${groupTag} ${reason}`);
          }
          continue;
        }

        // Other unknown errors also trigger fallback
        this.markDead(ep, String(error.message || error).slice(0, 60), poolName);
        errors.push(`${groupTag} ${String(error.message || error).slice(0, 60)}`);
        continue;
      }
    }

    // All endpoints failed
    const errorDetail = errors.length > 0 ? errors.join(' → ') : 'All endpoints in dead cache';
    
    if (errors.length > 0 && errors.every(e => e.includes('HTTP 403'))) {
      throw new TikHubError(
        `${poolName} all ${pool.length} endpoints failed: ${errorDetail} | All endpoints returned permission denied, please check TikHub account balance`,
        403
      );
    }
    
    if (errors.length > 0 && errors.every(e => e.includes('404'))) {
      throw new TikHubError(
        `${poolName} all ${pool.length} endpoints failed: ${errorDetail} | ⚠️ [Update needed] All endpoints returned 404, local config may be outdated → please run git pull origin main and retry`,
        404
      );
    }

    throw new TikHubError(`${poolName} all ${pool.length} endpoints failed: ${errorDetail}`);
  }

  /**
   * Reset dead endpoint cache
   */
  resetDeadCache(): void {
    this.deadEndpoints.clear();
    this.deadCategoryGroups.clear();
    this.softFailCounts.clear();
    this.http400Counts.clear();
  }

  /**
   * Reset dead cache for specific category (e.g., 'comments')
   */
  resetCategoryCache(category: string): void {
    // Remove category:group level dead cache
    for (const key of this.deadCategoryGroups.keys()) {
      if (key.startsWith(`${category}:`)) {
        this.deadCategoryGroups.delete(key);
      }
    }

    // Remove exact endpoint dead cache for pools in this category
    const catPools = Object.entries(this.poolCategories)
      .filter(([_, cat]) => cat === category)
      .map(([poolName]) => poolName);

    for (const poolName of catPools) {
      const pool = this.pools[poolName] || [];
      for (const ep of pool) {
        const key = this.epKey(ep);
        this.deadEndpoints.delete(key);
        this.softFailCounts.delete(key);
        this.http400Counts.delete(key);
      }
    }
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Object.keys(this.pools);
  }
}
