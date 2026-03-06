import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface Tool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ServerResult {
  name: string;
  success: boolean;
  tools?: Tool[];
  error?: string;
}

export interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

const TIMEOUT_MS = 10_000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

export async function connectAndQuery(
  name: string,
  config: ServerConfig
): Promise<ServerResult> {
  let transport: StdioClientTransport | null = null;
  let client: Client | null = null;

  try {
    // Create transport with server config
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
      stderr: 'pipe', // Capture stderr for error messages
    });

    // Create MCP client
    client = new Client(
      { name: 'mcp-token-tracker', version: '1.0.0' },
      { capabilities: {} }
    );

    // Connect with timeout (connect() calls start() internally)
    await Promise.race([
      client!.connect(transport!),
      timeout(TIMEOUT_MS)
    ]);

    // Get tools with timeout
    const response = await Promise.race([
      client.listTools(),
      timeout(TIMEOUT_MS)
    ]);

    const tools: Tool[] = response.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    return {
      name,
      success: true,
      tools,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      name,
      success: false,
      error,
    };
  } finally {
    // Always cleanup
    try {
      if (transport) {
        await transport.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
