#!/usr/bin/env bun
import { Command } from 'commander';
import { registerAnalyticsCommands } from './src/cli/analytics';
import { registerAuthCommands } from './src/cli/auth';
import { registerCalendarCommands } from './src/cli/calendar';
import { registerDraftCommands } from './src/cli/draft';
import { registerPublishCommands } from './src/cli/publish';
import { registerSchedulerCommands } from './src/cli/scheduler';

const program = new Command();

program
  .name('linkedin-content-tool')
  .description('CLI-based LinkedIn content automation tool')
  .version('0.1.0');

const draftCmd = program
  .command('draft')
  .description('Manage content drafts');
registerDraftCommands(draftCmd);

const publishCmd = program
  .command('publish')
  .description('Publish content to LinkedIn');
registerPublishCommands(publishCmd);

const calendarCmd = program
  .command('calendar')
  .description('Manage content calendar');
registerCalendarCommands(calendarCmd);

const analyticsCmd = program
  .command('analytics')
  .description('View post analytics');
registerAnalyticsCommands(analyticsCmd);

const authCmd = program
  .command('auth')
  .description('LinkedIn authentication');
registerAuthCommands(authCmd);

const schedulerCmd = program
  .command('scheduler')
  .description('Content scheduler');
registerSchedulerCommands(schedulerCmd);

program.parse(process.argv);
