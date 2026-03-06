# Tool Usage Tracking

Track which MCP tools are actually used via Claude Code hooks.

## Overview

Add a PostToolUse hook that logs MCP tool calls to a local JSON file. The scan command displays usage stats alongside token counts, making it obvious which high-token servers aren't being used.

## Hook Design

### Files

- `.claude/hooks/mcp-tool-logger.sh` - Shell wrapper
- `.claude/hooks/mcp-tool-logger.ts` - TypeScript handler

### Registration

In `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": ["mcp__*"],
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/mcp-tool-logger.sh"
      }]
    }]
  }
}
```

The `mcp__*` matcher ensures only MCP tool calls are logged.

### Data Captured

- `tool` - Tool name (e.g., `browser_navigate`)
- `server` - Server name parsed from prefix (e.g., `playwright`)
- `timestamp` - ISO 8601 timestamp
- `success` - Whether the call succeeded

## Data Storage

### Location

`~/.mcp-token-tracker/usage.json`

### Structure

```json
{
  "version": 1,
  "calls": [
    {
      "tool": "browser_navigate",
      "server": "playwright",
      "timestamp": "2025-03-06T14:32:00Z",
      "success": true
    }
  ]
}
```

### Management

- Create directory/file on first write
- Append new calls (read → add → write)
- Cap at 10,000 entries or 90 days

## Enhanced Scan Output

When usage data exists:

```
Servers:
  ✓ playwright         (22 tools)     3,769 tokens   12 calls (2h ago)
  ✓ context7           (2 tools)        995 tokens    8 calls (1d ago)
  ⚠ MCP_DOCKER         (43 tools)    10,220 tokens    0 calls (never)
  ✓ sequentialThinking (1 tools)      1,004 tokens    3 calls (5d ago)
```

- Shows call count and last used time per server
- Servers with 0 calls get warning icon
- No usage columns if data file doesn't exist

## Implementation

### New Files

1. `.claude/hooks/mcp-tool-logger.sh` - Shell wrapper
2. `.claude/hooks/mcp-tool-logger.ts` - TypeScript handler
3. `src/usage.ts` - Read/write usage data, compute stats

### Modified Files

1. `src/analyzer.ts` - Add usage columns to output
2. `.claude/settings.json` - Register the hook

### Usage Module Interface

```typescript
interface UsageCall {
  tool: string;
  server: string;
  timestamp: string;
  success: boolean;
}

interface UsageStats {
  totalCalls: number;
  lastUsed: Date | null;
}

function recordCall(call: UsageCall): void
function getUsageStats(): Map<string, UsageStats>
```
