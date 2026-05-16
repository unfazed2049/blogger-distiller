import { getProvider } from '../providers/registry';
import { getPlatform } from '../platforms/registry';
import type { DataProvider } from '../providers/base';
import type { PlatformAdapter } from '../platforms/base';

export interface CommandContext {
  provider: DataProvider;
  platform: PlatformAdapter;
}

export async function initializeContext(
  platformName: string,
  providerName: string = 'tikhub'
): Promise<CommandContext> {
  try {
    const provider = getProvider(providerName);
    const platform = getPlatform(platformName);
    
    return { provider, platform };
  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

export function outputJSON(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputError(error: unknown): void {
  const errorObj = {
    error: true,
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  };
  
  console.error(JSON.stringify(errorObj, null, 2));
}

export function handleCommandError(error: unknown): never {
  outputError(error);
  process.exit(1);
}
