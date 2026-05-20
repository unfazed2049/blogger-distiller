import { Command } from 'commander';
import { initializeContext, writeOutput, handleCommandError } from '../utils';

export function createSearchCommand(): Command {
  const command = new Command('search')
    .description('Search for bloggers or notes on XHS')
    .argument('<keyword>', 'Search keyword')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--limit <number>', 'Maximum number of results', '20')
    .option('--output-file <path>', 'Write output to file instead of stdout')
    .action(async (keyword: string, options) => {
      try {
        const { provider, platform } = await initializeContext('xhs', options.provider);
        const limit = parseInt(options.limit, 10);
        
        // Search for bloggers
        const results = await platform.searchBloggers(keyword, { limit });
        
        writeOutput({
          success: true,
          keyword,
          count: results.length,
          results
        }, options.outputFile);
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
