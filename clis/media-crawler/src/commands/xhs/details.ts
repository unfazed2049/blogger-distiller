import { Command } from 'commander';
import { initializeContext, writeOutput, handleCommandError } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

export function createDetailsCommand(): Command {
  const command = new Command('details')
    .description('Get detailed information for notes (output slimmed for analyze.py)')
    .option('--notes-file <path>', 'Path to notes list JSON file')
    .option('--note-ids <ids>', 'Comma-separated note IDs')
    .option('--provider <name>', 'Data provider to use', 'tikhub')
    .option('--output <dir>', 'Output directory', '.')
    .option('--output-file <path>', 'Write output to file instead of stdout')
    .option('--checkpoint-interval <number>', 'Save checkpoint every N notes', '10')
    .action(async (options) => {
      try {
        const { provider, platform } = await initializeContext('xhs', options.provider);
        
        // Get note IDs from file or command line
        let noteIds: string[] = [];
        if (options.notesFile) {
          const notesData = JSON.parse(fs.readFileSync(options.notesFile, 'utf-8'));
          noteIds = notesData.notes?.map((n: any) => n.id || n.noteId) || [];
        } else if (options.noteIds) {
          noteIds = options.noteIds.split(',').map((id: string) => id.trim());
        } else {
          throw new Error('Either --notes-file or --note-ids must be provided');
        }
        
        const outputDir = options.output;
        const checkpointInterval = parseInt(options.checkpointInterval, 10);
        const checkpointFile = path.join(outputDir, 'details_checkpoint.json');
        
        // Load checkpoint if exists
        let completedIds = new Set<string>();
        let details: any[] = [];
        
        if (fs.existsSync(checkpointFile)) {
          const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
          details = checkpoint.details || [];
          completedIds = new Set(checkpoint.completedIds || []);
          console.error(`Resuming from checkpoint: ${completedIds.size} notes already fetched`);
        }
        
        // Fetch details for each note
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < noteIds.length; i++) {
          const noteId = noteIds[i];
          
          // Skip if already completed
          if (completedIds.has(noteId)) {
            console.error(`[${i + 1}/${noteIds.length}] Skipping ${noteId} (already fetched)`);
            continue;
          }
          
          console.error(`[${i + 1}/${noteIds.length}] Fetching ${noteId}...`);
          
          try {
            const rawDetail = await provider.getNoteDetail('xhs', noteId);
            // Strip to only fields analyze.py needs
            const slimDetail = platform.normalizeNoteDetail(rawDetail);
            details.push(slimDetail);
            completedIds.add(noteId);
            successCount++;
          } catch (error) {
            console.error(`Error fetching ${noteId}:`, error);
            details.push({
              _feed_id: noteId,
              _error: error instanceof Error ? error.message : String(error),
              _content_restricted: true
            });
            errorCount++;
          }
          
          // Save checkpoint every N notes
          if ((successCount + errorCount) % checkpointInterval === 0) {
            fs.writeFileSync(checkpointFile, JSON.stringify({
              details,
              completedIds: Array.from(completedIds),
              timestamp: new Date().toISOString()
            }, null, 2));
            console.error(`Checkpoint saved: ${successCount} success, ${errorCount} errors`);
          }
        }
        
        // Clean up checkpoint file on success
        if (fs.existsSync(checkpointFile)) {
          fs.unlinkSync(checkpointFile);
        }
        
        writeOutput({
          success: true,
          total: noteIds.length,
          successCount,
          errorCount,
          details
        }, options.outputFile);
      } catch (error) {
        handleCommandError(error);
      }
    });
  
  return command;
}
