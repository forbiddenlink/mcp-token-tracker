import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectAndQuery, type ServerConfig } from './connector.js';

// Create mock instances that will be returned by constructors
const mockTransportInstance = {
  close: vi.fn(),
};

const mockClientInstance = {
  connect: vi.fn(),
  listTools: vi.fn(),
};

// Mock the MCP SDK with proper class mocks using function keyword
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(function () {
    return mockClientInstance;
  }),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(function () {
    return mockTransportInstance;
  }),
}));

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const MockTransport = vi.mocked(StdioClientTransport);

describe('connectAndQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset mock implementations
    mockClientInstance.connect.mockReset();
    mockClientInstance.listTools.mockReset();
    mockTransportInstance.close.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const testConfig: ServerConfig = {
    command: 'node',
    args: ['test-server.js'],
  };

  it('returns tools on successful connection', async () => {
    const mockTools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
      },
    ];

    mockClientInstance.connect.mockResolvedValue(undefined);
    mockClientInstance.listTools.mockResolvedValue({ tools: mockTools });

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.tools).toHaveLength(1);
    expect(result.tools![0].name).toBe('test_tool');
  });

  it('returns error when connection fails', async () => {
    mockClientInstance.connect.mockRejectedValue(new Error('Connection refused'));

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('returns error when listTools fails', async () => {
    mockClientInstance.connect.mockResolvedValue(undefined);
    mockClientInstance.listTools.mockRejectedValue(new Error('Tools not available'));

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Tools not available');
  });

  it('handles timeout', async () => {
    // Connection never resolves
    mockClientInstance.connect.mockImplementation(() => new Promise(() => {}));

    const resultPromise = connectAndQuery('test-server', testConfig);

    // Advance past the 10 second timeout
    await vi.advanceTimersByTimeAsync(11000);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('Timeout');
  });

  it('cleans up transport on error', async () => {
    mockTransportInstance.close.mockResolvedValue(undefined);
    mockClientInstance.connect.mockRejectedValue(new Error('Failed'));

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(mockTransportInstance.close).toHaveBeenCalled();
  });

  it('passes env variables to transport', async () => {
    const configWithEnv: ServerConfig = {
      command: 'node',
      args: ['server.js'],
      env: { API_KEY: 'test-key' },
    };

    mockClientInstance.connect.mockResolvedValue(undefined);
    mockClientInstance.listTools.mockResolvedValue({ tools: [] });

    const resultPromise = connectAndQuery('test-server', configWithEnv);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(MockTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'node',
        args: ['server.js'],
        env: expect.objectContaining({ API_KEY: 'test-key' }),
      })
    );
  });

  it('handles non-Error exceptions', async () => {
    mockClientInstance.connect.mockRejectedValue('String error');

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('String error');
  });

  it('maps tool response correctly', async () => {
    const mockTools = [
      {
        name: 'tool1',
        description: 'First tool',
        inputSchema: { type: 'object', properties: { foo: { type: 'string' } } },
      },
      {
        name: 'tool2',
        // No description
        inputSchema: { type: 'object' },
      },
    ];

    mockClientInstance.connect.mockResolvedValue(undefined);
    mockClientInstance.listTools.mockResolvedValue({ tools: mockTools });

    const resultPromise = connectAndQuery('test-server', testConfig);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.tools).toHaveLength(2);
    expect(result.tools![0]).toEqual({
      name: 'tool1',
      description: 'First tool',
      inputSchema: { type: 'object', properties: { foo: { type: 'string' } } },
    });
    expect(result.tools![1]).toEqual({
      name: 'tool2',
      description: undefined,
      inputSchema: { type: 'object' },
    });
  });
});
