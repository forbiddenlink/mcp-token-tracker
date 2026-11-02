# Security policy

## Reporting a vulnerability

Private vulnerability reporting is not enabled on this repository, so there is no private channel yet.

To report a problem, open a [GitHub issue](https://github.com/forbiddenlink/mcp-token-tracker/issues) that says you have a security concern and which part of the tool it touches. Leave out exploit details, proof-of-concept code, and any secrets. The maintainer can then arrange a private way to receive the details.

## What the tool reads

This section describes the code in `src/` as of the commit that added this file. Dependencies were not audited for this document.

`mcp-token-tracker scan` reads these files, if they exist (`src/scanner.ts`):

- `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop)
- `~/.claude.json` (Claude Code)
- `~/.cursor/mcp_config.json` (Cursor)
- `~/.windsurf/mcp.json` (Windsurf)

It parses each file as JSON and reads the `mcpServers` or `servers` object. It also reads `~/.mcp-token-tracker/usage.json`, a record of MCP tool calls (tool name, server name, timestamp, success flag), to show call counts (`src/usage.ts`).

## What stays local

- Token counting uses the `tiktoken` library on the local machine (`src/analyzer.ts`). The code in `src/` makes no network request in the default (estimate) mode.
- The CLI does not write to your MCP config files. It only reads them.
- The CLI does not write `usage.json`. The `recordCall` function in `src/usage.ts` has no caller. In this repository, a Claude Code hook (`.claude/hooks/mcp-tool-logger.ts`, not part of the published package) writes that file.
- `--json` prints results to standard output. Results include config file paths, server names, and token counts.
- Estimate mode serializes each server's config entry, including any `env` values, to count tokens. The text stays in memory and is not printed.

## Live mode runs your configured commands

`scan --live` starts each configured MCP server as a child process, using the `command`, `args`, and `env` from your config, and asks it for its tool list (`src/connector.ts`). The child inherits the current environment plus the config's `env`. Only use `--live` on configs you trust, because it executes whatever those configs name. Each connection times out after 10 seconds. Those servers can make their own network requests; this tool does not control that.

## Telemetry

The CLI does not send telemetry. Nothing reachable from `src/cli.ts` makes a network request itself. Three modules under `src/lib/` ship in the package but are not imported by the CLI:

- `src/lib/langfuse.ts` creates a Langfuse client only when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are both set, and sends to `LANGFUSE_HOST` or `https://cloud.langfuse.com`.
- `src/lib/config.ts` contains an `update-notifier` check for new package versions, which would contact the npm registry if called. Nothing calls it.
- `src/lib/logger.ts` is a local logger.

If you wire any of these into the CLI later, update this document.
