import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

const USAGE_DIR = join(homedir(), '.mcp-token-tracker');
const USAGE_FILE = join(USAGE_DIR, 'usage.json');
const MAX_ENTRIES = 10_000;
const MAX_AGE_DAYS = 90;

export interface UsageCall {
  tool: string;
  server: string;
  timestamp: string;
  success: boolean;
}

interface UsageData {
  version: number;
  calls: UsageCall[];
}

export interface UsageStats {
  totalCalls: number;
  lastUsed: Date | null;
}

function ensureDir(): void {
  if (!existsSync(USAGE_DIR)) {
    mkdirSync(USAGE_DIR, { recursive: true });
  }
}

function readUsageData(): UsageData {
  if (!existsSync(USAGE_FILE)) {
    return { version: 1, calls: [] };
  }
  try {
    const content = readFileSync(USAGE_FILE, 'utf-8');
    return JSON.parse(content) as UsageData;
  } catch {
    return { version: 1, calls: [] };
  }
}

function writeUsageData(data: UsageData): void {
  ensureDir();
  writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function pruneOldEntries(calls: UsageCall[]): UsageCall[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString();

  // Filter by age
  let pruned = calls.filter(c => c.timestamp >= cutoffStr);

  // Cap at max entries (keep most recent)
  if (pruned.length > MAX_ENTRIES) {
    pruned = pruned.slice(-MAX_ENTRIES);
  }

  return pruned;
}

export function recordCall(call: UsageCall): void {
  const data = readUsageData();
  data.calls.push(call);
  data.calls = pruneOldEntries(data.calls);
  writeUsageData(data);
}

export function getUsageStats(): Map<string, UsageStats> {
  const data = readUsageData();
  const stats = new Map<string, UsageStats>();

  for (const call of data.calls) {
    const existing = stats.get(call.server);
    const callDate = new Date(call.timestamp);

    if (existing) {
      existing.totalCalls++;
      if (!existing.lastUsed || callDate > existing.lastUsed) {
        existing.lastUsed = callDate;
      }
    } else {
      stats.set(call.server, {
        totalCalls: 1,
        lastUsed: callDate,
      });
    }
  }

  return stats;
}

export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
