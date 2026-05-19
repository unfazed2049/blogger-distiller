import { Command } from 'commander';
import { initializeContext, outputJSON, handleCommandError } from '../utils';

export function createProfileCommand(): Command {
  const command = new Command('profile')
    .description('Get blogger profile information')
    .argument('<user-id>', 'User ID')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--token <token>', 'XHS xsec_token (optional)')
    .action(async (userId: string, options) => {
      try {
        const { provider } = await initializeContext('xhs', options.provider);
        
        // Get profile data
        const profile = await provider.getProfile('xhs', userId);
        
        outputJSON({
          success: true,
          userId,
          profile
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
