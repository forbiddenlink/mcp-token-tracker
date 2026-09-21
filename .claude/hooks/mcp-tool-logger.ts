import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const USAGE_DIR = join(homedir(), '.mcp-token-tracker')
const USAGE_FILE = join(USAGE_DIR, 'usage.json')

interface PostToolUseInput {
  tool_name: string
  tool_input: Record<string, unknown>
  tool_response?: {
    isError?: boolean
  }
}

interface UsageCall {
  tool: string
  server: string
  timestamp: string
  success: boolean
}

interface UsageData {
  version: number
  calls: UsageCall[]
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data)
    })
  })
}

export function parseServerAndTool(toolName: string): { server: string; tool: string } | null {
  // MCP tools are formatted as: mcp__servername__toolname
  // Server names are allowed to contain underscores (e.g. mcp__claude_ai_Sentry__search_issues,
  // mcp__plugin_playwright_playwright__browser_click), so the delimiter is the first "__" after
  // the "mcp__" prefix, not "any run of non-underscore characters". Everything after that
  // delimiter is the tool name, which may itself contain "__" (mcp__a__b__c -> server "a", tool
  // "b__c"), matching Claude Code's own first-segment convention.
  if (!toolName.startsWith('mcp__')) return null
  const idx = toolName.indexOf('__', 5)
  if (idx === -1) return null
  const server = toolName.slice(5, idx)
  const tool = toolName.slice(idx + 2)
  if (!server || !tool) return null
  return { server, tool }
}

function ensureDir(): void {
  if (!existsSync(USAGE_DIR)) {
    mkdirSync(USAGE_DIR, { recursive: true })
  }
}

function readUsageData(): UsageData {
  if (!existsSync(USAGE_FILE)) {
    return { version: 1, calls: [] }
  }
  try {
    const content = readFileSync(USAGE_FILE, 'utf-8')
    return JSON.parse(content) as UsageData
  } catch {
    return { version: 1, calls: [] }
  }
}

function writeUsageData(data: UsageData): void {
  ensureDir()
  writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2))
}

function recordCall(call: UsageCall): void {
  const data = readUsageData()
  data.calls.push(call)

  // Prune old entries (keep last 10k or 90 days)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString()
  data.calls = data.calls.filter((c) => c.timestamp >= cutoffStr).slice(-10000)

  writeUsageData(data)
}

async function main() {
  const input: PostToolUseInput = JSON.parse(await readStdin())

  const parsed = parseServerAndTool(input.tool_name)
  if (parsed) {
    recordCall({
      tool: parsed.tool,
      server: parsed.server,
      timestamp: new Date().toISOString(),
      success: !input.tool_response?.isError,
    })
  } else {
    // Don't drop this silently - stderr doesn't touch the hook's stdout JSON contract,
    // so it won't block the user, but it gives a trail when a tool name doesn't parse.
    process.stderr.write(`mcp-tool-logger: could not parse server/tool from "${input.tool_name}"\n`)
  }

  // Always continue - this is just logging
  console.log(JSON.stringify({ result: 'continue' }))
}

// Only run when this file is executed directly (as the hook does via tsx), not when imported
// by tests - importing would otherwise call main() and block forever waiting on stdin.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  main().catch(() => {
    // On error, still continue - don't block the user
    console.log(JSON.stringify({ result: 'continue' }))
  })
}
