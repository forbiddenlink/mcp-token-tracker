import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface MCPConfig {
  path: string
  name: string
  servers: Record<string, any>
}

const CONFIG_LOCATIONS = [
  {
    path: join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
    name: 'Claude Desktop',
  },
  {
    path: join(homedir(), '.claude.json'),
    name: 'Claude Code',
  },
  {
    path: join(homedir(), '.cursor/mcp_config.json'),
    name: 'Cursor',
  },
  {
    path: join(homedir(), '.windsurf/mcp.json'),
    name: 'Windsurf',
  },
]

export async function scanMCPConfigs(): Promise<MCPConfig[]> {
  const configs: MCPConfig[] = []

  for (const location of CONFIG_LOCATIONS) {
    if (existsSync(location.path)) {
      try {
        const content = readFileSync(location.path, 'utf-8')
        const parsed = JSON.parse(content)

        // Different tools have different structures
        const servers = parsed.mcpServers || parsed.servers || {}

        // Validate entries independently: malformed neighbors must not hide valid servers.
        if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
          const validServers = Object.fromEntries(
            Object.entries(servers).filter(([, server]) => {
              if (!server || typeof server !== 'object' || Array.isArray(server)) return false
              return ['command', 'transport', 'url'].some((field) => {
                const value = (server as Record<string, unknown>)[field]
                return typeof value === 'string' && value.trim().length > 0
              })
            })
          )
          if (Object.keys(validServers).length > 0) {
            configs.push({ path: location.path, name: location.name, servers: validServers })
          }
        }
      } catch {
        // Parser and filesystem errors can contain raw config fragments or sensitive paths.
        // Report only the fixed client label, never the exception or input.
        console.error(
          `Could not read or parse ${location.name} configuration. Check file access and JSON syntax.`
        )
      }
    }
  }

  return configs
}
