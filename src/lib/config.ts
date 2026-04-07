/**
 * MCP Token Tracker CLI configuration using `conf`.
 * Persists user preferences, API keys, and usage thresholds.
 */
import Conf from 'conf';
import boxen from 'boxen';
import updateNotifier from 'update-notifier';

export interface TrackerConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  dailyTokenBudget: number;
  monthlyTokenBudget: number;
  alertThreshold: number; // 0–1, fraction of budget to alert at
  currency: string;
  costPer1kInputTokens: Record<string, number>;
  costPer1kOutputTokens: Record<string, number>;
  notifyOnBudgetAlert: boolean;
}

const DEFAULT_CONFIG: TrackerConfig = {
  dailyTokenBudget: 500_000,
  monthlyTokenBudget: 10_000_000,
  alertThreshold: 0.8,
  currency: 'USD',
  costPer1kInputTokens: {
    'claude-3-5-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    'claude-3-opus': 0.015,
    'gpt-4o': 0.005,
    'gpt-4o-mini': 0.00015,
  },
  costPer1kOutputTokens: {
    'claude-3-5-sonnet': 0.015,
    'claude-3-haiku': 0.00125,
    'claude-3-opus': 0.075,
    'gpt-4o': 0.015,
    'gpt-4o-mini': 0.0006,
  },
  notifyOnBudgetAlert: true,
};

export const config = new Conf<TrackerConfig>({
  projectName: 'mcp-token-tracker',
  defaults: DEFAULT_CONFIG,
});

/** Display the current config in a formatted box. */
export function displayConfig(): void {
  const current = config.store;
  const lines = [
    `Daily budget:   ${current.dailyTokenBudget.toLocaleString()} tokens`,
    `Monthly budget: ${current.monthlyTokenBudget.toLocaleString()} tokens`,
    `Alert at:       ${Math.round(current.alertThreshold * 100)}% usage`,
    `Currency:       ${current.currency}`,
  ];
  console.log(
    boxen(lines.join('\n'), {
      title: 'MCP Token Tracker Config',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'cyan',
    })
  );
}

/** Calculate estimated cost for a token usage. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const cfg = config.store;
  const inputCost = ((cfg.costPer1kInputTokens[model] ?? 0.005) * inputTokens) / 1000;
  const outputCost = ((cfg.costPer1kOutputTokens[model] ?? 0.015) * outputTokens) / 1000;
  return inputCost + outputCost;
}

/** Check for CLI updates and notify if newer version exists. */
export function checkForUpdates(pkg: { name: string; version: string }): void {
  const notifier = updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 24 });
  if (notifier.update) {
    console.log(
      boxen(`Update available: ${notifier.update.current} → ${notifier.update.latest}\nRun: npm i -g ${pkg.name}`, {
        padding: 1,
        borderColor: 'yellow',
        title: 'Update Available',
        titleAlignment: 'center',
      })
    );
  }
}
