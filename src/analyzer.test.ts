import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./usage.js', () => ({
  getUsageStats: () =>
    new Map([
      ['beta', { totalCalls: 5, lastUsed: new Date() }],
      ['alpha', { totalCalls: 1, lastUsed: new Date() }],
    ]),
  formatTimeAgo: () => 'just now',
}))

import { analyzeTokens } from './analyzer.js'

const config = {
  name: 'Test config',
  path: '/tmp/none.json',
  servers: {
    alpha: { command: 'npx', args: ['-y', 'alpha-server'] },
    beta: { command: 'node', args: ['beta.js'] },
    gamma: { command: 'uvx', args: ['gamma'] },
  },
}

function captureOutput() {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '))
  })
  return { lines, spy }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI colour codes
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')

afterEach(() => vi.restoreAllMocks())

describe('estimate mode (no --live)', () => {
  it('flags the whole result as an estimate and every server as an estimate', async () => {
    const result = await analyzeTokens(config, false, { print: false })
    expect(result.isEstimate).toBe(true)
    expect(result.servers.every((s) => s.isEstimate)).toBe(true)
  })

  it('does not order servers by an identical constant token count', async () => {
    const result = await analyzeTokens(config, false, { print: false })
    // Order by observed usage (calls desc), then name; not by the estimate.
    expect(result.servers.map((s) => s.name)).toEqual(['beta', 'alpha', 'gamma'])
  })

  it('labels printed numbers and cost as estimates and points at --live', async () => {
    const { lines } = captureOutput()
    await analyzeTokens(config, false)
    const out = strip(lines.join('\n'))
    expect(out).toMatch(/estimate/i)
    expect(out).toMatch(/--live/)
    for (const row of out.split('\n').filter((l) => /\b(alpha|beta|gamma)\b/.test(l))) {
      expect(row).toMatch(/~[\d,]+/)
    }
    expect(out).toMatch(/placeholder/i)
  })
})
