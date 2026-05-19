import type { PlatformAdapter } from './base';
import { XHSAdapter } from './xhs';
import { getProvider } from '../providers/registry';

/**
 * PlatformRegistry - manages available platform adapters
 * Allows dynamic registration and retrieval of platform adapters
 */
class PlatformRegistry {
  private platforms: Map<string, PlatformAdapter> = new Map();
  private initialized = false;
  
  /**
   * Initialize default platforms (lazy initialization)
   */
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      // Register default platforms
      const tikHubProvider = getProvider('tikhub');
      this.register(new XHSAdapter(tikHubProvider));
      this.initialized = true;
    } catch (error) {
      // If initialization fails, we'll handle it when get() is called
      console.error('Warning: Failed to initialize default platforms:', error);
    }
  }
  
  /**
   * Register a new platform adapter
   */
  register(adapter: PlatformAdapter): void {
    this.platforms.set(adapter.name, adapter);
  }
  
  /**
   * Get a platform adapter by name
   * @param name - Platform name (e.g., 'xhs', 'douyin')
   * @returns PlatformAdapter instance
   * @throws Error if platform not found
   */
  get(name: string): PlatformAdapter {
    this.initialize();
    
    const platform = this.platforms.get(name);
    if (!platform) {
      const available = Array.from(this.platforms.keys()).join(', ');
      throw new Error(`Unknown platform: ${name}. Available platforms: ${available || 'none'}`);
    }
    return platform;
  }
  
  /**
   * Get list of available platform names
   */
  list(): string[] {
    this.initialize();
    return Array.from(this.platforms.keys());
  }
  
  /**
   * Check if a platform exists
   */
  has(name: string): boolean {
    this.initialize();
    return this.platforms.has(name);
  }
}

// Export singleton instance
export const platformRegistry = new PlatformRegistry();

// Export helper function
export function getPlatform(name: string): PlatformAdapter {
  return platformRegistry.get(name);
}

