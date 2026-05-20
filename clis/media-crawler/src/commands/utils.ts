import * as fs from 'fs';
import * as path from 'path';
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

/**
 * Write JSON output to file or stdout.
 * When outputFile is provided, writes formatted JSON to that path
 * (creating parent directories as needed). Otherwise prints to stdout.
 */
export function writeOutput(data: any, outputFile?: string): void {
  const json = JSON.stringify(data, null, 2);
  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFile, json, 'utf-8');
    console.error(`Output written to: ${outputFile}`);
  } else {
    console.log(json);
  }
}

/** @deprecated Use writeOutput(data, outputFile) instead */
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
