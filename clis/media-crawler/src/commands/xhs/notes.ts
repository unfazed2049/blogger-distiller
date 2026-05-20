import { Command } from 'commander';
import { initializeContext, writeOutput, handleCommandError } from '../utils';

export function createNotesCommand(): Command {
  const command = new Command('notes')
    .description('Get notes list for a user')
    .argument('<user-id>', 'User ID')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--max-notes <number>', 'Maximum number of notes to fetch', '100')
    .option('--output-file <path>', 'Write output to file instead of stdout')
    .action(async (userId: string, options) => {
      try {
        const { provider } = await initializeContext('xhs', options.provider);
        const maxNotes = parseInt(options.maxNotes, 10);
        
        let allNotes: any[] = [];
        let cursor = options.cursor;
        let hasMore = true;
        
        // Fetch notes with pagination
        while (hasMore && allNotes.length < maxNotes) {
          const result = await provider.getNotesList('xhs', userId, cursor);
          allNotes = allNotes.concat(result.notes);
          
          hasMore = result.hasMore && allNotes.length < maxNotes;
          cursor = result.cursor;
          
          if (!hasMore || !cursor) break;
        }
        
        // Trim to max notes
        if (allNotes.length > maxNotes) {
          allNotes = allNotes.slice(0, maxNotes);
        }
        
        writeOutput({
          success: true,
          userId,
          count: allNotes.length,
          notes: allNotes,
          hasMore,
          cursor
        }, options.outputFile);
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
