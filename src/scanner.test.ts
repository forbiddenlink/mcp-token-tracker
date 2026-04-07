import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { scanMCPConfigs } from './scanner.js';

vi.mock('fs');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('scanMCPConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no config files exist', async () => {
    const configs = await scanMCPConfigs();
    expect(configs).toEqual([]);
  });

  it('parses valid Claude Desktop config', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json');
    });

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          playwright: {
            command: 'npx',
            args: ['-y', '@anthropic/mcp-playwright'],
          },
        },
      })
    );

    const configs = await scanMCPConfigs();

    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('Claude Desktop');
    expect(configs[0].servers).toHaveProperty('playwright');
  });

  it('parses config with "servers" key (alternative format)', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('.cursor/mcp_config.json');
    });

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        servers: {
          myserver: {
            command: 'node',
            args: ['server.js'],
          },
        },
      })
    );

    const configs = await scanMCPConfigs();

    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('Cursor');
  });

  it('skips files with invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ invalid json }');

    // Should not throw
    const configs = await scanMCPConfigs();
    expect(configs).toEqual([]);
  });

  it('skips files without MCP server structure', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json');
    });

    // Valid JSON but not MCP config structure
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        someOtherKey: 'value',
      })
    );

    const configs = await scanMCPConfigs();
    expect(configs).toEqual([]);
  });

  it('skips servers without command/transport/url', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json');
    });

    // Has mcpServers but server config lacks required fields
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          invalid: {
            someOtherField: 'value',
          },
        },
      })
    );

    const configs = await scanMCPConfigs();
    expect(configs).toEqual([]);
  });

  it('accepts servers with transport field', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json');
    });

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          remote: {
            transport: 'sse',
            url: 'https://example.com/mcp',
          },
        },
      })
    );

    const configs = await scanMCPConfigs();
    expect(configs).toHaveLength(1);
  });

  it('accepts servers with url field', async () => {
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('Claude/claude_desktop_config.json');
    });

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          remote: {
            url: 'https://example.com/mcp',
          },
        },
      })
    );

    const configs = await scanMCPConfigs();
    expect(configs).toHaveLength(1);
  });

  it('finds multiple config files when they exist', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: {
          test: {
            command: 'node',
            args: ['test.js'],
          },
        },
      })
    );

    const configs = await scanMCPConfigs();
    // Should find all 4 locations
    expect(configs).toHaveLength(4);
  });
});
