import type { DataProvider } from './base';
import { TikHubProvider } from './tikhub';

/**
 * ProviderRegistry - manages available data providers
 * Allows dynamic registration and retrieval of providers
 */
class ProviderRegistry {
  private providers: Map<string, DataProvider> = new Map();
  private initialized = false;
  
  /**
   * Initialize default providers (lazy initialization)
   */
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      // Register default providers
      this.register(new TikHubProvider());
      this.initialized = true;
    } catch (error) {
      // If initialization fails (e.g., missing token), we'll handle it when get() is called
      console.error('Warning: Failed to initialize default providers:', error);
    }
  }
  
  /**
   * Register a new provider
   */
  register(provider: DataProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  /**
   * Get a provider by name
   * @param name - Provider name (e.g., 'tikhub')
   * @returns DataProvider instance
   * @throws Error if provider not found
   */
  get(name: string): DataProvider {
    this.initialize();
    
    const provider = this.providers.get(name);
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(`Unknown provider: ${name}. Available providers: ${available || 'none'}`);
    }
    return provider;
  }
  
  /**
   * Get list of available provider names
   */
  list(): string[] {
    this.initialize();
    return Array.from(this.providers.keys());
  }
  
  /**
   * Check if a provider exists
   */
  has(name: string): boolean {
    this.initialize();
    return this.providers.has(name);
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

// Export helper function
export function getProvider(name: string): DataProvider {
  return providerRegistry.get(name);
}
