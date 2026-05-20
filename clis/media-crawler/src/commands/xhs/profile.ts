import { Command } from 'commander';
import { initializeContext, writeOutput, handleCommandError } from '../utils';

export function createProfileCommand(): Command {
  const command = new Command('profile')
    .description('Get blogger profile information')
    .argument('<user-id>', 'User ID')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--token <token>', 'XHS xsec_token (optional)')
    .option('--output-file <path>', 'Write output to file instead of stdout')
    .action(async (userId: string, options) => {
      try {
        const { provider } = await initializeContext('xhs', options.provider);
        
        // Get profile data
        const profile = await provider.getProfile('xhs', userId);
        
        writeOutput({
          success: true,
          userId,
          profile
        }, options.outputFile);
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
