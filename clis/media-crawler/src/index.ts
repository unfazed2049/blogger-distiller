#!/usr/bin/env bun
import 'dotenv/config';  // 自动加载项目根 .env（向上查找）
import { Command } from 'commander';
import { createXHSCommand } from './commands/xhs';

const program = new Command();

program
  .name('media-crawler')
  .description('Unified CLI tool for crawling social media platforms')
  .version('1.0.0');

// Add platform subcommands
program.addCommand(createXHSCommand());

// Future platforms:
// program.addCommand(createDouyinCommand());

program.parse();
