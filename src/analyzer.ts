import chalk from 'chalk';
import { encoding_for_model } from 'tiktoken';
import type { MCPConfig } from './scanner.js';
import { connectAndQuery, type Tool, type ServerConfig } from './connector.js';

interface ServerAnalysis {
  name: string;
  tokens: number;
  estimatedCost: number;
  toolCount?: number;
  isEstimate: boolean;
  error?: string;
}

function countToolTokens(tools: Tool[], enc: ReturnType<typeof encoding_for_model>): number {
  let total = 0;
  for (const tool of tools) {
    // Count tokens for tool definition as it appears in context
    const toolDef = JSON.stringify({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, null, 2);
    total += enc.encode(toolDef).length;
  }
  return total;
}

function estimateTokens(serverConfig: unknown, enc: ReturnType<typeof encoding_for_model>): number {
  const configString = JSON.stringify(serverConfig, null, 2);
  const configTokens = enc.encode(configString).length;
  // Rough multiplier: each server typically has 5-10 tools, each ~100-200 tokens
  const estimatedTools = 8;
  const tokensPerTool = 150;
  return configTokens + (estimatedTools * tokensPerTool);
}

export async function analyzeTokens(config: MCPConfig, liveMode = false) {
  console.log(chalk.cyan.bold(`\n📁 ${config.name}`));
  console.log(chalk.gray(`   ${config.path}\n`));

  const enc = encoding_for_model('gpt-4');
  let totalTokens = 0;
  const serverAnalysis: ServerAnalysis[] = [];
  const failures: Array<{ name: string; error: string }> = [];

  // Analyze each server
  for (const [serverName, serverConfig] of Object.entries(config.servers)) {
    if (liveMode) {
      process.stdout.write(chalk.gray(`  Connecting to ${serverName}...`));

      const typedConfig = serverConfig as ServerConfig;
      const result = await connectAndQuery(serverName, typedConfig);

      // Clear the "Connecting..." line
      process.stdout.write('\r' + ' '.repeat(50) + '\r');

      if (result.success && result.tools) {
        const tokens = countToolTokens(result.tools, enc);
        totalTokens += tokens;
        const estimatedCost = (tokens / 1000) * 0.002;

        serverAnalysis.push({
          name: serverName,
          tokens,
          estimatedCost,
          toolCount: result.tools.length,
          isEstimate: false,
        });
      } else {
        // Fall back to estimate
        const tokens = estimateTokens(serverConfig, enc);
        totalTokens += tokens;
        const estimatedCost = (tokens / 1000) * 0.002;

        serverAnalysis.push({
          name: serverName,
          tokens,
          estimatedCost,
          isEstimate: true,
          error: result.error,
        });
        failures.push({ name: serverName, error: result.error || 'Unknown error' });
      }
    } else {
      // Estimate mode (original behavior)
      const tokens = estimateTokens(serverConfig, enc);
      totalTokens += tokens;
      const estimatedCost = (tokens / 1000) * 0.002;

      serverAnalysis.push({
        name: serverName,
        tokens,
        estimatedCost,
        isEstimate: true,
      });
    }
  }

  enc.free();

  // Display results
  console.log(chalk.white('Servers:'));
  for (const analysis of serverAnalysis) {
    const icon = analysis.isEstimate && liveMode ? chalk.yellow('⚠') : chalk.green('✓');
    const toolInfo = analysis.toolCount !== undefined
      ? chalk.gray(`(${analysis.toolCount} tools)`.padEnd(12))
      : liveMode && analysis.isEstimate
        ? chalk.gray('(estimate)'.padEnd(12))
        : '            ';
    const tokenStr = analysis.isEstimate && liveMode
      ? `~${analysis.tokens.toLocaleString()}`
      : analysis.tokens.toLocaleString();

    console.log(
      `  ${icon} ${chalk.white(analysis.name.padEnd(22))} ${toolInfo}` +
      `${chalk.yellow(tokenStr.padStart(7))} tokens ` +
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

  // Show connection failures
  if (failures.length > 0) {
    console.log(chalk.yellow('\n⚠️  Connection issues:'));
    for (const f of failures) {
      console.log(chalk.gray(`   • ${f.name}: ${f.error}`));
    }
  }

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
