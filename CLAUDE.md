# mcp-token-tracker

CLI that scans MCP (Model Context Protocol) configs on disk and estimates the token cost of
loaded tool definitions, to help decide which MCP servers to keep loaded. Repo:
https://github.com/forbiddenlink/mcp-token-tracker

## What it does

Scans known MCP config locations (Claude Desktop, Claude Code, Cursor, Windsurf), counts tool
definition tokens with tiktoken, estimates monthly cost, and reports per-server usage (call
counts, last-used) when the Claude Code hook has been logging calls.

## Stack

- TypeScript, strict mode, ESM (`"type": "module"`), target ES2022
- Node 20 (`.nvmrc`)
- pnpm 10.34.5 (pinned via `packageManager`)
- Commander.js (CLI), chalk (color output), boxen (config display), conf (persisted user config)
- tiktoken for token counting, `@modelcontextprotocol/sdk` for live server connections (`--live`)
- pino for structured logging
- Langfuse (optional, only active if `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are set)

## Commands

```
pnpm install
pnpm dev              # tsx src/cli.ts scan
pnpm build            # tsc -> dist/
pnpm start            # node dist/cli.js
pnpm check            # build + test
pnpm test             # vitest run
pnpm lint-baseline    # biome check .
pnpm audit            # pnpm audit --audit-level high
```

CLI usage: `pnpm dev` (fast estimate), `pnpm start scan --json` (machine-readable), `npx tsx
src/cli.ts scan --live` (connects to servers for real tool definitions).

## Layout

- `src/cli.ts` - Commander entry point, `scan` command
- `src/scanner.ts` - finds and parses MCP config files
- `src/analyzer.ts` - token counting and cost estimation
- `src/connector.ts` - live JSON-RPC connection to MCP servers (`--live` mode)
- `src/usage.ts` - reads/writes `~/.mcp-token-tracker/usage.json` (call history, capped at
  10,000 entries / 90 days)
- `src/lib/config.ts` - persisted user config via `conf` (budgets, per-model cost tables)
- `src/lib/logger.ts` - pino logger + child loggers per module
- `src/lib/langfuse.ts` - optional Langfuse client
- `src/trigger/` - empty except `.gitkeep`; see Gotchas
- `*.test.ts` files are colocated with the source they test (vitest)

## Conventions

- Biome (`biome.json`) is the enforced formatter/linter: single quotes, no semicolons except
  where ASI is ambiguous, 2-space indent, 100-char lines, organize-imports on.
- `eslint.config.js` also exists (typescript-eslint + eslint-config-prettier) but no package.json
  script runs it; treat Biome as the source of truth unless told otherwise.
- Env vars are read directly via `process.env.*`, no schema/validation layer.

## Testing

Vitest, colocated `*.test.ts` files, v8 coverage. `pnpm test` runs once; `pnpm check` runs build
then test. CI (`.github/workflows/ci.yml`) runs install + lint (`pnpm lint-baseline`) + build +
test.

## Env vars

- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` - enable Langfuse tracing when both are set
- `LANGFUSE_HOST` - optional, defaults to `https://cloud.langfuse.com`
- `NODE_ENV`, `LOG_LEVEL` - logger level/mode (pino-pretty in development)
- `VERCEL_GIT_COMMIT_SHA` - optional, passed to Langfuse as `release`
- `TRIGGER_PROJECT_REF` - required by `trigger.config.ts`; throws at config load if unset

`.env`, `.env.local`, `.env*.local` are gitignored; values were not read for this file.

## Gotchas

- `trigger.config.ts` imports `@trigger.dev/sdk/v3` and `@trigger.dev/build/extensions/core`;
  both packages are declared in `package.json` (`@trigger.dev/sdk` in dependencies,
  `@trigger.dev/build` in devDependencies, matching versions per Trigger.dev's own requirement).
  The Trigger.dev integration is still otherwise unfinished (`src/trigger/` has only a
  `.gitkeep`).
- `pnpm.overrides` in `package.json` pins several transitive CVE fixes
  (express-rate-limit, hono, path-to-regexp, @hono/node-server, fast-uri, vite, qs).
  `.github/workflows/verify-overrides.yml` exists specifically because a lockfile
  regenerated with the wrong pnpm version can silently drop this block; don't remove
  overrides without checking that workflow.

## Claude Code

- `.claude/settings.json` registers a `PostToolUse` hook (`mcp__*` matcher) that runs
  `.claude/hooks/mcp-tool-logger.sh` -> `mcp-tool-logger.ts` to log MCP tool calls into
  `~/.mcp-token-tracker/usage.json`, which the tracker's own `--json` output then reads back.
- `.hq/project.json` marks this repo `kind: tool`, `automationLevel: manual`, feeding the
  owner's `hq` usage/agent-ops reporting.
