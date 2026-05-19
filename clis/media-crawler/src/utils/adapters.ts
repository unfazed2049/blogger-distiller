/**
 * Utility functions for platform adapters
 * Common helpers for data extraction, pagination, and error handling
 */

/**
 * Extract nested data from object using dot notation path
 * @param obj - Source object
 * @param path - Dot notation path (e.g., 'data.user.name')
 * @param defaultValue - Default value if path not found
 */
export function extractData<T = any>(obj: any, path: string, defaultValue?: T): T | undefined {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * PaginationHelper - handles pagination logic
 */
export class PaginationHelper {
  constructor(
    private hasMore: boolean,
    private cursor?: string,
    private total?: number
  ) {}
  
  /**
   * Check if there are more pages
   */
  hasNextPage(): boolean {
    return this.hasMore;
  }
  
  /**
   * Get next cursor for pagination
   */
  getNextCursor(): string | undefined {
    return this.cursor;
  }
  
  /**
   * Get total count if available
   */
  getTotal(): number | undefined {
    return this.total;
  }
  
  /**
   * Create from API response
   */
  static fromResponse(data: any): PaginationHelper {
    return new PaginationHelper(
      data.has_more || data.hasMore || false,
      data.cursor || data.next_cursor || data.nextCursor,
      data.total || data.total_count || data.totalCount
    );
  }
}

/**
 * Translate platform-specific error to common format
 * @param error - Platform-specific error
 * @param platform - Platform identifier
 */
export function translateError(error: any, platform: string): Error {
  const message = error.message || error.msg || 'Unknown error';
  const code = error.code || error.error_code || error.errorCode;
  const statusCode = error.status || error.statusCode || error.status_code;
  
  const translatedError = new Error(
    `[${platform.toUpperCase()}] ${message}${code ? ` (code: ${code})` : ''}`
  );
  
  // Attach additional properties
  (translatedError as any).code = code;
  (translatedError as any).statusCode = statusCode;
  (translatedError as any).platform = platform;
  (translatedError as any).originalError = error;
  
  return translatedError;
}

/**
 * Parse count string (e.g., "1.2万" -> 12000)
 * @param str - Count string
 */
export function parseCount(str: string | number): number {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  
  str = String(str).trim();
  
  // Handle Chinese "万" (10,000)
  if (str.endsWith('万')) {
    return Math.floor(parseFloat(str.slice(0, -1)) * 10000);
  }
  
  // Handle "k" or "K" (1,000)
  if (str.toLowerCase().endsWith('k')) {
    return Math.floor(parseFloat(str.slice(0, -1)) * 1000);
  }
  
  // Remove commas and parse
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

/**
 * Safe filename - remove invalid characters
 * @param name - Original filename
 */
export function safeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200); // Limit length
}

/**
 * Retry with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in ms
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
