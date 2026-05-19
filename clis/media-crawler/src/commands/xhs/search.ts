import { Command } from 'commander';
import { initializeContext, outputJSON, handleCommandError } from '../utils';

export function createSearchCommand(): Command {
  const command = new Command('search')
    .description('Search for bloggers or notes on XHS')
    .argument('<keyword>', 'Search keyword')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--limit <number>', 'Maximum number of results', '20')
    .action(async (keyword: string, options) => {
      try {
        const { provider, platform } = await initializeContext('xhs', options.provider);
        const limit = parseInt(options.limit, 10);
        
        // Search for bloggers
        const results = await platform.searchBloggers(keyword, { limit });
        
        outputJSON({
          success: true,
          keyword,
          count: results.length,
          results
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
