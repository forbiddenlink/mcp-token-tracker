import chalk from 'chalk'
import { encoding_for_model } from 'tiktoken'
import { connectAndQuery, type ServerConfig, type Tool } from './connector.js'
import type { MCPConfig } from './scanner.js'
import { formatTimeAgo, getUsageStats } from './usage.js'
import { lookupUsage } from './usage-match.js'

/**
 * Placeholder rate used only to give a rough dollar figure. It is not a current
 * price for any specific model, so every cost shown is labelled an estimate.
 */
const PLACEHOLDER_USD_PER_1K_TOKENS = 0.002
const SESSIONS_PER_MONTH = 30

export interface ServerAnalysis {
  name: string
  tokens: number
  estimatedCost: number
  toolCount?: number
  isEstimate: boolean
  error?: string
  callCount?: number
  lastUsed?: Date | null
}

function countToolTokens(tools: Tool[], enc: ReturnType<typeof encoding_for_model>): number {
  let total = 0
  for (const tool of tools) {
    // Count tokens for tool definition as it appears in context
    const toolDef = JSON.stringify(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      null,
      2
    )
    total += enc.encode(toolDef).length
  }
  return total
}

function estimateTokens(serverConfig: unknown, enc: ReturnType<typeof encoding_for_model>): number {
  const configString = JSON.stringify(serverConfig, null, 2)
  const configTokens = enc.encode(configString).length
  // Rough multiplier: each server typically has 5-10 tools, each ~100-200 tokens
  // Estimate mode never connects to the server, so the real tool list is unknown.
  // These are assumptions, not measurements; use --live for measured counts.
  const estimatedTools = 8
  const tokensPerTool = 150
  return configTokens + estimatedTools * tokensPerTool
}

export interface ConfigAnalysis {
  name: string
  path: string
  totalTokens: number
  monthlyCost: number
  /** True when any server's token count is a guess rather than a measured tool list. */
  isEstimate: boolean
  servers: ServerAnalysis[]
  failures: Array<{ name: string; error: string }>
}

export async function analyzeTokens(
  config: MCPConfig,
  liveMode = false,
  opts: { print?: boolean } = {}
): Promise<ConfigAnalysis> {
  const shouldPrint = opts.print ?? true
  if (shouldPrint) {
    console.log(chalk.cyan.bold(`\n📁 ${config.name}`))
    console.log(chalk.gray(`   ${config.path}\n`))
  }

  const enc = encoding_for_model('gpt-4')
  const usageStats = getUsageStats()
  const hasUsageData = usageStats.size > 0

  let totalTokens = 0
  const serverAnalysis: ServerAnalysis[] = []
  const failures: Array<{ name: string; error: string }> = []

  // Analyze each server
  for (const [serverName, serverConfig] of Object.entries(config.servers)) {
    if (liveMode) {
      if (shouldPrint) process.stdout.write(chalk.gray(`  Connecting to ${serverName}...`))

      const typedConfig = serverConfig as ServerConfig
      const result = await connectAndQuery(serverName, typedConfig)

      // Clear the "Connecting..." line
      if (shouldPrint) process.stdout.write(`\r${' '.repeat(50)}\r`)

      const stats = lookupUsage(usageStats, serverName)

      if (result.success && result.tools) {
        const tokens = countToolTokens(result.tools, enc)
        totalTokens += tokens
        const estimatedCost = (tokens / 1000) * PLACEHOLDER_USD_PER_1K_TOKENS

        serverAnalysis.push({
          name: serverName,
          tokens,
          estimatedCost,
          toolCount: result.tools.length,
          isEstimate: false,
          callCount: stats?.totalCalls ?? 0,
          lastUsed: stats?.lastUsed ?? null,
        })
      } else {
        // Fall back to estimate
        const tokens = estimateTokens(serverConfig, enc)
        totalTokens += tokens
        const estimatedCost = (tokens / 1000) * PLACEHOLDER_USD_PER_1K_TOKENS

        serverAnalysis.push({
          name: serverName,
          tokens,
          estimatedCost,
          isEstimate: true,
          error: result.error,
          callCount: stats?.totalCalls ?? 0,
          lastUsed: stats?.lastUsed ?? null,
        })
        failures.push({ name: serverName, error: result.error || 'Unknown error' })
      }
    } else {
      // Estimate mode (original behavior)
      const tokens = estimateTokens(serverConfig, enc)
      totalTokens += tokens
      const estimatedCost = (tokens / 1000) * PLACEHOLDER_USD_PER_1K_TOKENS
      const stats = lookupUsage(usageStats, serverName)

      serverAnalysis.push({
        name: serverName,
        tokens,
        estimatedCost,
        isEstimate: true,
        callCount: stats?.totalCalls ?? 0,
        lastUsed: stats?.lastUsed ?? null,
      })
    }
  }

  enc.free()

  const monthlyCost = (totalTokens / 1000) * PLACEHOLDER_USD_PER_1K_TOKENS * SESSIONS_PER_MONTH
  const anyEstimate = serverAnalysis.some((a) => a.isEstimate)

  // Estimates are near-identical per server, so ranking by them is meaningless.
  // Rank by measured tokens only when every number is measured; otherwise by
  // observed usage (calls), then name.
  serverAnalysis.sort((a, b) =>
    anyEstimate
      ? (b.callCount ?? 0) - (a.callCount ?? 0) || a.name.localeCompare(b.name)
      : b.tokens - a.tokens || a.name.localeCompare(b.name)
  )

  const result: ConfigAnalysis = {
    name: config.name,
    path: config.path,
    totalTokens,
    monthlyCost,
    isEstimate: anyEstimate,
    servers: serverAnalysis,
    failures,
  }

  if (!shouldPrint) return result

  // Display results
  if (anyEstimate) {
    console.log(
      chalk.yellow(
        liveMode
          ? 'Some numbers below are estimates (marked ~): those servers could not be queried.'
          : 'Estimate mode: numbers are rough guesses (marked ~), not measurements.'
      )
    )
    console.log(
      chalk.gray(
        '  Each unmeasured server is assumed to expose ~8 tools at ~150 tokens each, so they all look alike.'
      )
    )
    console.log(chalk.gray('  Run with --live to measure the real tool lists.\n'))
  }
  console.log(chalk.white('Servers:'))
  for (const analysis of serverAnalysis) {
    // Icon: warning if estimate in live mode, or if no calls and we have usage data
    const noUsage = hasUsageData && analysis.callCount === 0
    const icon = (analysis.isEstimate && liveMode) || noUsage ? chalk.yellow('⚠') : chalk.green('✓')

    const toolInfo =
      analysis.toolCount !== undefined
        ? chalk.gray(`(${analysis.toolCount} tools)`.padEnd(12))
        : analysis.isEstimate
          ? chalk.gray('(estimate)'.padEnd(12))
          : '            '

    const tokenStr = analysis.isEstimate
      ? `~${analysis.tokens.toLocaleString()}`
      : analysis.tokens.toLocaleString()

    // Usage info (only show if we have usage data)
    const usageStr = hasUsageData
      ? chalk.cyan(`${String(analysis.callCount).padStart(4)} calls `) +
        chalk.gray(`(${formatTimeAgo(analysis.lastUsed ?? null)})`)
      : ''

    console.log(
      `  ${icon} ${chalk.white(analysis.name.padEnd(20))} ${toolInfo}` +
        `${chalk.yellow(tokenStr.padStart(7))} tokens  ${usageStr}`
    )
  }

  // Summary
  console.log(chalk.gray(`\n${'─'.repeat(60)}`))
  console.log(
    `  ${chalk.white.bold('Total:')} ` +
      `${chalk.yellow.bold(`${anyEstimate ? '~' : ''}${totalTokens.toLocaleString()}`)} tokens ` +
      `${chalk.gray(`(~${(totalTokens / 1000).toFixed(1)}k)`)}`
  )

  console.log(
    `  ${chalk.white.bold('Est. Monthly Cost:')} ` +
      `${chalk.green.bold(`~$${monthlyCost.toFixed(2)}`)}`
  )
  console.log(
    chalk.gray(
      `  (placeholder rate $${PLACEHOLDER_USD_PER_1K_TOKENS}/1k tokens x ${SESSIONS_PER_MONTH} sessions; not a current model price)`
    )
  )

  // Show connection failures
  if (failures.length > 0) {
    console.log(chalk.yellow('\n⚠️  Connection issues:'))
    for (const f of failures) {
      console.log(chalk.gray(`   • ${f.name}: ${f.error}`))
    }
  }

  // Recommendations
  if (totalTokens > 5000) {
    console.log(chalk.yellow('\n💡 Recommendations:'))
    console.log(chalk.gray('   • Consider unloading unused MCP servers'))
    console.log(chalk.gray('   • Keep only frequently-used tools loaded'))
    console.log(
      chalk.gray(
        `   • Potential savings: ~${Math.floor(totalTokens * 0.3).toLocaleString()} tokens`
      )
    )
  } else if (totalTokens > 3000) {
    console.log(chalk.blue('\n💡 Token usage is moderate'))
    console.log(chalk.gray('   • Review which servers you actually use'))
  } else {
    console.log(chalk.green('\n✓ Token usage looks good!'))
  }

  return result
}
