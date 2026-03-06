import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const USAGE_DIR = join(homedir(), '.mcp-token-tracker');
const USAGE_FILE = join(USAGE_DIR, 'usage.json');

interface PostToolUseInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: {
    isError?: boolean;
  };
}

interface UsageCall {
  tool: string;
  server: string;
  timestamp: string;
  success: boolean;
}

interface UsageData {
  version: number;
  calls: UsageCall[];
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { resolve(data); });
  });
}

function parseServerAndTool(toolName: string): { server: string; tool: string } | null {
  // MCP tools are formatted as: mcp__servername__toolname
  const match = toolName.match(/^mcp__([^_]+)__(.+)$/);
  if (match) {
    return { server: match[1], tool: match[2] };
  }
  return null;
}

function ensureDir(): void {
  if (!existsSync(USAGE_DIR)) {
    mkdirSync(USAGE_DIR, { recursive: true });
  }
}

function readUsageData(): UsageData {
  if (!existsSync(USAGE_FILE)) {
    return { version: 1, calls: [] };
  }
  try {
    const content = readFileSync(USAGE_FILE, 'utf-8');
    return JSON.parse(content) as UsageData;
  } catch {
    return { version: 1, calls: [] };
  }
}

function writeUsageData(data: UsageData): void {
  ensureDir();
  writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function recordCall(call: UsageCall): void {
  const data = readUsageData();
  data.calls.push(call);

  // Prune old entries (keep last 10k or 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString();
  data.calls = data.calls
    .filter(c => c.timestamp >= cutoffStr)
    .slice(-10000);

  writeUsageData(data);
}

async function main() {
  const input: PostToolUseInput = JSON.parse(await readStdin());

  const parsed = parseServerAndTool(input.tool_name);
  if (parsed) {
    recordCall({
      tool: parsed.tool,
      server: parsed.server,
      timestamp: new Date().toISOString(),
      success: !input.tool_response?.isError,
    });
  }

  // Always continue - this is just logging
  console.log(JSON.stringify({ result: 'continue' }));
}

main().catch(() => {
  // On error, still continue - don't block the user
  console.log(JSON.stringify({ result: 'continue' }));
});
