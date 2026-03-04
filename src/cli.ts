#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { scanMCPConfigs } from './scanner.js';
import { analyzeTokens } from './analyzer.js';

const program = new Command();

program
  .name('mcp-token-tracker')
  .description('Track MCP server token usage and costs')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan for MCP configurations and calculate token usage')
  .action(async () => {
    console.log(chalk.blue.bold('\n🔍 MCP Token Cost Tracker\n'));
    
    try {
      // Find MCP configs
      console.log(chalk.gray('Scanning for MCP configurations...'));
      const configs = await scanMCPConfigs();
      
      if (configs.length === 0) {
        console.log(chalk.yellow('\n⚠️  No MCP configurations found'));
        console.log(chalk.gray('Looking in:'));
        console.log(chalk.gray('  - ~/Library/Application Support/Claude/claude_desktop_config.json'));
        console.log(chalk.gray('  - ~/.claude.json'));
        console.log(chalk.gray('  - ~/.cursor/mcp_config.json'));
        console.log(chalk.gray('  - ~/.windsurf/mcp.json'));
        return;
      }
      
      console.log(chalk.green(`✓ Found ${configs.length} configuration(s)\n`));
      
      // Analyze each config
      for (const config of configs) {
        await analyzeTokens(config);
      }
      
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    }
  });

program.parse();
