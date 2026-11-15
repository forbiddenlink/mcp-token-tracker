# MCP Token Cost Tracker

A command-line tool that shows how many tokens your Model Context Protocol (MCP) servers add to your AI coding tool's context window, and which servers you actually use.

It is for people who run several MCP servers in Claude Desktop, Claude Code, Cursor or Windsurf and want to find servers that cost context but are never called.

## What it does

- Finds MCP server configurations for supported tools.
- Counts the tokens in each server's tool definitions with `tiktoken`. In the default mode this is an estimate based on the server configuration; with `--live` it connects to each server and counts its real tool definitions.
- Shows an estimated monthly cost. The rate is a placeholder (`$0.002` per 1k tokens times 30 sessions, `src/analyzer.ts`), not a current model price, and the tool says so in its output.
- Joins the scan with a call log written by an optional Claude Code hook, so servers with no calls stand out.

## Supported tools

| Tool           | Config path                                                       |
| -------------- | ----------------------------------------------------------------- |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code    | `~/.claude.json`                                                  |
| Cursor         | `~/.cursor/mcp_config.json`                                       |
| Windsurf       | `~/.windsurf/mcp.json`                                            |

## Getting started

Prerequisites: Node 20 (see `.nvmrc`) and pnpm. The package is not published to npm, so run it from a clone.

```bash
git clone https://github.com/forbiddenlink/mcp-token-tracker.git
cd mcp-token-tracker
pnpm install
pnpm dev                      # scan with fast estimates
```

## Usage

```bash
pnpm dev                      # scan, estimate mode (tsx src/cli.ts scan)
pnpm dev --json               # machine-readable output
pnpm dev --live               # connect to servers for real token counts (slower)

pnpm build                    # compile to dist/
pnpm start scan               # run the built CLI
pnpm start scan --live
```

Options for `scan`: `--live` and `--json`.

## Example output

```
MCP Token Cost Tracker

Servers:
  playwright         (22 tools)     3,769 tokens    12 calls (2h ago)
  context7           (2 tools)        995 tokens     8 calls (1d ago)
  MCP_DOCKER         (43 tools)    10,220 tokens     0 calls (never)

Total: 14,984 tokens (~15.0k)
Est. Monthly Cost: ~$0.90
(placeholder rate $0.002/1k tokens x 30 sessions; not a current model price)
```

The numbers above are illustrative. Servers with zero calls are flagged so you can consider unloading them.

## Usage tracking in Claude Code

A `PostToolUse` hook logs MCP tool calls to `~/.mcp-token-tracker/usage.json`, and the scan reads that file. To enable it in a Claude Code project, copy `.claude/settings.json` and `.claude/hooks/` from this repo into the project.

## Development

```bash
pnpm test              # vitest run
pnpm build             # tsc
pnpm check             # build and test
pnpm lint-baseline     # biome check .
pnpm audit             # pnpm audit --audit-level high
```

## Project structure

```
src/cli.ts            CLI entry (commander)
src/scanner.ts        Finds MCP config files
src/connector.ts      Connects to servers for --live
src/analyzer.ts       Token counting, cost estimate and report
src/usage.ts          Reads the hook's call log
src/usage-match.ts    Matches logged calls to servers
.claude/hooks/        PostToolUse logging hook
```

`src/lib/` holds optional logging and Langfuse tracing helpers (Langfuse is used only when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set; the scan command does not call it).

## Roadmap

- [x] Connect to actual MCP servers via JSON-RPC (`--live`)
- [x] Track real tool usage via Claude Code hooks
- [ ] Historical tracking
- [ ] Auto-optimize config files
- [ ] Web dashboard

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
