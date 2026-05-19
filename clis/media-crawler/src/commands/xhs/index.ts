import { Command } from 'commander';
import { createSearchCommand } from './search';
import { createProfileCommand } from './profile';
import { createNotesCommand } from './notes';
import { createDetailsCommand } from './details';

export function createXHSCommand(): Command {
  const xhs = new Command('xhs')
    .description('Xiaohongshu (小红书) platform commands');
  
  // Add subcommands
  xhs.addCommand(createSearchCommand());
  xhs.addCommand(createProfileCommand());
  xhs.addCommand(createNotesCommand());
  xhs.addCommand(createDetailsCommand());
  
  return xhs;
}
