import type { UsageStats } from './usage.js'

// The PostToolUse hook logs the server segment of the tool name exactly as Claude Code
// builds it: "claude_ai_<Connector>" for claude.ai connectors and
// "plugin_<plugin>_<server>" for plugin servers. Config files key the same server by its
// bare name, so a plain Map lookup misses both and shows used servers as never called.

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function matches(logged: string, configName: string): boolean {
  const l = norm(logged)
  const c = norm(configName)
  if (l === c) return true
  if (l === `claude_ai_${c}`) return true
  return l.startsWith('plugin_') && l.endsWith(`_${c}`)
}

export function lookupUsage(
  stats: Map<string, UsageStats>,
  configName: string
): UsageStats | undefined {
  let merged: UsageStats | undefined
  for (const [logged, s] of stats) {
    if (!matches(logged, configName)) continue
    if (!merged) {
      merged = { totalCalls: s.totalCalls, lastUsed: s.lastUsed }
      continue
    }
    merged.totalCalls += s.totalCalls
    if (s.lastUsed && (!merged.lastUsed || s.lastUsed > merged.lastUsed)) {
      merged.lastUsed = s.lastUsed
    }
  }
  return merged
}
