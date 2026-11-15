import { describe, expect, it } from 'vitest'
import { lookupUsage } from './usage-match.js'

const now = new Date('2026-11-15T00:00:00Z')
const older = new Date('2026-11-01T00:00:00Z')

describe('lookupUsage', () => {
  it('matches the exact config key', () => {
    const stats = new Map([['github', { totalCalls: 3, lastUsed: now }]])
    expect(lookupUsage(stats, 'github')?.totalCalls).toBe(3)
  })

  it('matches claude.ai connector names to the bare config key', () => {
    const stats = new Map([['claude_ai_Sentry', { totalCalls: 4, lastUsed: now }]])
    expect(lookupUsage(stats, 'Sentry')?.totalCalls).toBe(4)
    expect(lookupUsage(stats, 'sentry')?.totalCalls).toBe(4)
  })

  it('matches connector names with spaces in the config key', () => {
    const stats = new Map([['claude_ai_Google_Sheets', { totalCalls: 2, lastUsed: now }]])
    expect(lookupUsage(stats, 'Google Sheets')?.totalCalls).toBe(2)
  })

  it('matches plugin_<plugin>_<server> names to the server key', () => {
    const stats = new Map([['plugin_playwright_playwright', { totalCalls: 7, lastUsed: now }]])
    expect(lookupUsage(stats, 'playwright')?.totalCalls).toBe(7)
  })

  it('sums every logged name that maps to one config key', () => {
    const stats = new Map([
      ['playwright', { totalCalls: 1, lastUsed: older }],
      ['plugin_playwright_playwright', { totalCalls: 2, lastUsed: now }],
    ])
    const got = lookupUsage(stats, 'playwright')
    expect(got?.totalCalls).toBe(3)
    expect(got?.lastUsed).toEqual(now)
  })

  it('does not match a different server that merely shares a suffix', () => {
    const stats = new Map([['plugin_x_notgithub', { totalCalls: 9, lastUsed: now }]])
    expect(lookupUsage(stats, 'github')).toBeUndefined()
  })

  it('returns undefined when nothing matches', () => {
    expect(lookupUsage(new Map(), 'alpha')).toBeUndefined()
  })
})
