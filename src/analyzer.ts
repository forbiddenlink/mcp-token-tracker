import chalk from 'chalk';
import { encoding_for_model } from 'tiktoken';
import type { MCPConfig } from './scanner.js';

export async function analyzeTokens(config: MCPConfig) {
  console.log(chalk.cyan.bold(`\n📁 ${config.name}`));
  console.log(chalk.gray(`   ${config.path}\n`));
  
  const enc = encoding_for_model('gpt-4');
  let totalTokens = 0;
  const serverAnalysis: Array<{
    name: string;
    tokens: number;
    estimatedCost: number;
  }> = [];
  
  // Analyze each server
  for (const [serverName, serverConfig] of Object.entries(config.servers)) {
    // Estimate tokens based on server configuration
    // In reality, we'd need to connect to the server and get tool definitions
    // For now, estimate based on config size
    const configString = JSON.stringify(serverConfig, null, 2);
    const tokens = enc.encode(configString).length;
    
    // Rough multiplier: each server typically has 5-10 tools
    // Each tool definition is ~100-200 tokens
    const estimatedTools = 8; // average
    const tokensPerTool = 150; // average
    const estimatedTokens = tokens + (estimatedTools * tokensPerTool);
    
    totalTokens += estimatedTokens;
    
    // Estimate cost (rough calculation)
    // Average AI coding tool: $20/mo for ~100k tokens/day
    // Cost per 1k tokens: ~$0.002
    const estimatedCost = (estimatedTokens / 1000) * 0.002;
    
    serverAnalysis.push({
      name: serverName,
      tokens: estimatedTokens,
      estimatedCost
    });
  }
  
  enc.free();
  
  // Display results
  console.log(chalk.white('Servers:'));
  for (const analysis of serverAnalysis) {
    console.log(
      `  ${chalk.green('✓')} ${chalk.white(analysis.name.padEnd(30))} ` +
      `${chalk.yellow(analysis.tokens.toLocaleString().padStart(6))} tokens ` +
      `${chalk.gray(`($${analysis.estimatedCost.toFixed(4)}/session)`)}`
    );
  }
  
  // Summary
  console.log(chalk.gray('\n' + '─'.repeat(60)));
  console.log(
    `  ${chalk.white.bold('Total:')} ` +
    `${chalk.yellow.bold(totalTokens.toLocaleString())} tokens ` +
    `${chalk.gray(`(~${(totalTokens / 1000).toFixed(1)}k)`)}`
  );
  
  const monthlyCost = (totalTokens / 1000) * 0.002 * 30; // 30 sessions/month estimate
  console.log(
    `  ${chalk.white.bold('Est. Monthly Cost:')} ` +
    `${chalk.green.bold(`$${monthlyCost.toFixed(2)}`)}`
  );
  
  // Recommendations
  if (totalTokens > 5000) {
    console.log(chalk.yellow('\n💡 Recommendations:'));
    console.log(chalk.gray('   • Consider unloading unused MCP servers'));
    console.log(chalk.gray('   • Keep only frequently-used tools loaded'));
    console.log(chalk.gray(`   • Potential savings: ~${Math.floor(totalTokens * 0.3).toLocaleString()} tokens`));
  } else if (totalTokens > 3000) {
    console.log(chalk.blue('\n💡 Token usage is moderate'));
    console.log(chalk.gray('   • Review which servers you actually use'));
  } else {
    console.log(chalk.green('\n✓ Token usage looks good!'));
  }
}
