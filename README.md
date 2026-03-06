# MCP Token Cost Tracker

> Track token usage and costs for MCP servers in AI coding tools

## What It Does

Scans your MCP (Model Context Protocol) configurations and estimates how many tokens are being loaded into your AI coding tool's context window. Helps you:

- See which MCP servers are consuming the most tokens
- Estimate monthly costs based on usage
- Get recommendations for optimization

## Supported Tools

- **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`)
- **Claude Code** (`~/.claude.json`)
- **Cursor** (`~/.cursor/mcp_config.json`)
- **Windsurf** (`~/.windsurf/mcp.json`)

## Installation

```bash
# Clone or download
cd mcp-token-tracker

# Install dependencies
pnpm install

# Run
pnpm dev
```

## Usage

```bash
# Scan for MCP configs and analyze token usage (fast estimates)
pnpm dev

# Connect to servers for real token counts (slower but accurate)
npx tsx src/cli.ts scan --live

# Or after building:
pnpm build
pnpm start scan
pnpm start scan --live
```

## Example Output

```
🔍 MCP Token Cost Tracker

Scanning for MCP configurations...
✓ Found 1 configuration(s)

📁 Claude Desktop
   /Users/you/Library/Application Support/Claude/claude_desktop_config.json

Servers:
  ✓ playwright                      1,232 tokens ($0.0025/session)
  ✓ context7                        1,278 tokens ($0.0026/session)
  ✓ servicecurator                  1,236 tokens ($0.0025/session)

────────────────────────────────────────────────────────────
  Total: 3,746 tokens (~3.7k)
  Est. Monthly Cost: $0.22

✓ Token usage looks good!
```

## How It Works

1. **Scans** known MCP config file locations
2. **Estimates** token usage based on server configuration
3. **Calculates** approximate monthly costs
4. **Recommends** optimizations if usage is high

## Why This Matters

Every MCP server you load adds tool definitions to your AI's context window. With 5-10 servers, you could be burning **4,000+ tokens** on tools you're not even using. This tool helps you:

- Identify which servers are worth keeping loaded
- Unload unused servers to save tokens (and money)
- Optimize your MCP configuration

## Tech Stack

- **TypeScript** - Type-safe CLI
- **Commander.js** - CLI framework
- **Chalk** - Terminal colors
- **Tiktoken** - Token counting (OpenAI's official library)

## Usage Tracking (Claude Code)

When used in a Claude Code project, MCP tool calls are automatically logged. The scan output shows which servers you actually use:

```
Servers:
  ✓ playwright         (22 tools)     3,769 tokens    12 calls (2h ago)
  ✓ context7           (2 tools)        995 tokens     8 calls (1d ago)
  ⚠ MCP_DOCKER         (43 tools)    10,220 tokens     0 calls (never)
```

Servers with 0 calls get a warning icon, making it easy to identify candidates for removal.

**Setup:** Copy `.claude/settings.json` and `.claude/hooks/` to your Claude Code project to enable tracking.

## Roadmap

- [x] Connect to actual MCP servers via JSON-RPC (`--live` flag)
- [x] Track real tool usage via Claude Code hooks
- [ ] Historical tracking (see usage over time)
- [ ] Auto-optimize config files
- [ ] Web dashboard

## License

MIT

## Author

Elizabeth Stein
