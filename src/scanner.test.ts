import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanMCPConfigs } from './scanner.js'

vi.mock('node:fs', () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }))

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)

describe('scanMCPConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no files exist
    mockExistsSync.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when no config files exist', async () => {
    const configs = await scanMCPConfigs()
    expect(configs).toEqual([])
  })

  it('parses valid Claude Desktop config', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json')
    })

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          playwright: {
            command: 'npx',
            args: ['-y', '@anthropic/mcp-playwright'],
          },
        },
      })
    )

    const configs = await scanMCPConfigs()

    expect(configs).toHaveLength(1)
    expect(configs[0].name).toBe('Claude Desktop')
    expect(configs[0].servers).toHaveProperty('playwright')
  })

  it('parses config with "servers" key (alternative format)', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('.cursor/mcp_config.json')
    })

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        servers: {
          myserver: {
            command: 'node',
            args: ['server.js'],
          },
        },
      })
    )

    const configs = await scanMCPConfigs()

    expect(configs).toHaveLength(1)
    expect(configs[0].name).toBe('Cursor')
  })

  it('skips files with invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('{ invalid json }')

    // Should not throw
    const configs = await scanMCPConfigs()
    expect(configs).toEqual([])
  })

  it('skips files without MCP server structure', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json')
    })

    // Valid JSON but not MCP config structure
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        someOtherKey: 'value',
      })
    )

    const configs = await scanMCPConfigs()
    expect(configs).toEqual([])
  })

  it('skips servers without command/transport/url', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json')
    })

    // Has mcpServers but server config lacks required fields
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          invalid: {
            someOtherField: 'value',
          },
        },
      })
    )

    const configs = await scanMCPConfigs()
    expect(configs).toEqual([])
  })

  it('accepts servers with transport field', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json')
    })

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          remote: {
            transport: 'sse',
            url: 'https://example.com/mcp',
          },
        },
      })
    )

    const configs = await scanMCPConfigs()
    expect(configs).toHaveLength(1)
  })

  it('accepts servers with url field', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json')
    })

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          remote: {
            url: 'https://example.com/mcp',
          },
        },
      })
    )

    const configs = await scanMCPConfigs()
    expect(configs).toHaveLength(1)
  })

  it('finds multiple config files when they exist', async () => {
    mockExistsSync.mockReturnValue(true)

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          test: {
            command: 'node',
            args: ['test.js'],
          },
        },
      })
    )

    const configs = await scanMCPConfigs()
    // Should find all 4 locations
    expect(configs).toHaveLength(4)
  })
})

describe('mixed server entries with fake filesystem only', () => {
  it.each([true, false])(
    'keeps valid neighbors regardless of invalid entry order: %s',
    async (invalidFirst) => {
      mockExistsSync.mockReturnValue(true)
      const valid = { command: 'synthetic', args: ['example'] }
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: invalidFirst ? { invalid: {}, valid } : { valid, invalid: {} },
        })
      )
      const configs = await scanMCPConfigs()
      expect(configs).toHaveLength(4)
      for (const config of configs) expect(config.servers).toEqual({ valid })
    }
  )
  it('rejects primitives, arrays and blank or non-string identifying fields', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          nil: null,
          array: [],
          primitive: 'node',
          blank: { command: '  ' },
          numeric: { command: 42 },
          remote: { url: 'https://example.invalid/mcp' },
        },
      })
    )
    const configs = await scanMCPConfigs()
    expect(configs).toHaveLength(4)
    for (const config of configs) expect(Object.keys(config.servers)).toEqual(['remote'])
  })
})

describe('safe configuration diagnostics', () => {
  afterEach(() => vi.restoreAllMocks())
  it.each(['parse', 'read'])(
    'does not log raw config or exception contents on %s failure',
    async (failure) => {
      const canary = 'SYNTHETIC_PRIVATE_CONFIG_CANARY'
      mockExistsSync.mockImplementation((path) => String(path).includes('.cursor/mcp_config.json'))
      if (failure === 'read') {
        mockReadFileSync.mockImplementation(() => {
          throw new Error(canary)
        })
      } else {
        mockReadFileSync.mockReturnValue(`${canary} not JSON`)
      }
      const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(await scanMCPConfigs()).toEqual([])
      expect(diagnostic.mock.calls).toEqual([
        ['Could not read or parse Cursor configuration. Check file access and JSON syntax.'],
      ])
      expect(diagnostic.mock.calls.flat().map(String).join(' ')).not.toContain(canary)
    }
  )
})
