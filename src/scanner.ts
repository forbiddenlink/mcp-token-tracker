import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface MCPConfig {
  path: string;
  name: string;
  servers: Record<string, any>;
}

const CONFIG_LOCATIONS = [
  {
    path: join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
    name: 'Claude Desktop'
  },
  {
    path: join(homedir(), '.claude.json'),
    name: 'Claude Code'
  },
  {
    path: join(homedir(), '.cursor/mcp_config.json'),
    name: 'Cursor'
  },
  {
    path: join(homedir(), '.windsurf/mcp.json'),
    name: 'Windsurf'
  }
];

export async function scanMCPConfigs(): Promise<MCPConfig[]> {
  const configs: MCPConfig[] = [];
  
  for (const location of CONFIG_LOCATIONS) {
    if (existsSync(location.path)) {
      try {
        const content = readFileSync(location.path, 'utf-8');
        const parsed = JSON.parse(content);
        
        // Different tools have different structures
        const servers = parsed.mcpServers || parsed.servers || {};
        
        // Only add if we found actual MCP server configs
        // (not just any JSON file)
        if (servers && Object.keys(servers).length > 0 && typeof servers === 'object') {
          // Verify it looks like MCP config (has command/transport fields)
          const firstServer = Object.values(servers)[0] as any;
          if (firstServer && (firstServer.command || firstServer.transport || firstServer.url)) {
            configs.push({
              path: location.path,
              name: location.name,
              servers
            });
          }
        }
      } catch (error) {
        // Skip invalid JSON
        console.error(`Error reading ${location.name}:`, error);
      }
    }
  }
  
  return configs;
}
