# Live MCP Server Connection

Connect to actual MCP servers to get real tool definitions instead of estimates.

## Overview

Add a `--live` flag to the `scan` command that spawns each MCP server, queries its tool definitions via JSON-RPC, and counts tokens on the actual response.

## Architecture

### New file: `src/connector.ts`

Handles spawning MCP servers and querying tools:

```
connector.ts
├── connectAndQuery(serverName, serverConfig) → ServerResult
│   ├── Spawn process using command + args + env
│   ├── Create StdioClientTransport from stdin/stdout
│   ├── Initialize MCP Client and connect
│   ├── Call client.listTools()
│   └── Cleanup: client.close(), process.kill()
```

### Dependencies

Uses existing `@modelcontextprotocol/sdk`:
- `Client` from `@modelcontextprotocol/sdk/client/index.js`
- `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`

## CLI Changes

### Flag addition

```bash
pnpm dev              # Fast estimates (current behavior)
pnpm dev --live       # Connect to servers for real token counts
```

### Output format

```
Servers:
  ✓ playwright         (12 tools)     2,847 tokens ($0.0057/session)
  ✓ context7           (3 tools)        892 tokens ($0.0018/session)
  ⚠ kindred            (timeout)     ~1,353 tokens (estimated)

Connection issues:
  • kindred: Server did not respond within 10s
```

## Error Handling

### Failure modes

| Failure | Detection | Response |
|---------|-----------|----------|
| Command not found | Spawn error | Show path, fall back to estimate |
| Server crashes | Exit code / stderr | Capture error, fall back |
| Server hangs | 10s timeout | Kill process, fall back |
| Invalid MCP response | JSON parse / schema | Log issue, fall back |
| Missing env vars | Server stderr | Show hint, fall back |

### Process cleanup

- Always kill spawned processes, even on errors
- Use `finally` blocks to ensure cleanup
- 15s hard timeout per server (connect + query + cleanup)

### Failure summary

- Collect all failures during scan
- Print summary at end with actionable info
- No stack traces in main output

## Token Counting

When `--live` is active:
- Pass actual tool definitions JSON to tiktoken
- Remove heuristic multiplier (8 tools × 150 tokens)
- Count: tool name + description + input schema for each tool

## Implementation

### Timeout handling

```typescript
const result = await Promise.race([
  connectAndQuery(name, config),
  timeout(10000).then(() => ({ error: 'timeout' }))
]);
```

### Connector structure

```typescript
interface ServerResult {
  name: string;
  success: boolean;
  tools?: Tool[];
  error?: string;
}

async function connectAndQuery(
  name: string,
  config: ServerConfig
): Promise<ServerResult>
```

## Files to create/modify

1. **Create** `src/connector.ts` - Server spawning and querying
2. **Modify** `src/cli.ts` - Add `--live` flag
3. **Modify** `src/analyzer.ts` - Accept real tool data, update token counting
