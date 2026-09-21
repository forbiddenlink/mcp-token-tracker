import { describe, expect, it } from 'vitest'
import { parseServerAndTool } from './mcp-tool-logger.js'

describe('parseServerAndTool', () => {
  it('parses a server name containing underscores (claude_ai connector)', () => {
    expect(parseServerAndTool('mcp__claude_ai_Sentry__search_issues')).toEqual({
      server: 'claude_ai_Sentry',
      tool: 'search_issues',
    })
  })

  it('parses a plugin-namespaced server name with multiple underscores', () => {
    expect(parseServerAndTool('mcp__plugin_playwright_playwright__browser_click')).toEqual({
      server: 'plugin_playwright_playwright',
      tool: 'browser_click',
    })
  })

  it('parses a short server name whose tool name also contains an underscore', () => {
    expect(parseServerAndTool('mcp__hq__hq_brief')).toEqual({
      server: 'hq',
      tool: 'hq_brief',
    })
  })

  it('parses a hyphenated server name', () => {
    expect(parseServerAndTool('mcp__codebase-memory-mcp__search_graph')).toEqual({
      server: 'codebase-memory-mcp',
      tool: 'search_graph',
    })
  })

  it('splits on the first "__" after the prefix, matching Claude Code tool naming', () => {
    expect(parseServerAndTool('mcp__a__b__c')).toEqual({
      server: 'a',
      tool: 'b__c',
    })
  })

  it('returns null for a non-MCP tool name', () => {
    expect(parseServerAndTool('Bash')).toBeNull()
  })

  it('returns null when there is no second "__" delimiter', () => {
    expect(parseServerAndTool('mcp__onlyone')).toBeNull()
  })
})
