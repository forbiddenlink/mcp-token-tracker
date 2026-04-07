import pino from 'pino';
import { randomUUID } from 'crypto';

/**
 * Pino structured logging for mcp-token-tracker
 *
 * Usage:
 *   import { logger, scannerLogger, analyzerLogger } from './lib/logger.js';
 *   logger.info({ configPath }, 'Scanning MCP configs');
 *   scannerLogger.debug({ serverCount: 5 }, 'Found servers');
 *   analyzerLogger.error({ err }, 'Token analysis failed');
 *
 * Child loggers with correlation IDs:
 *   const reqLogger = createRequestLogger();
 *   reqLogger.info('Processing scan request');
 */

const isDevelopment = process.env['NODE_ENV'] === 'development';

export const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'mcp-token-tracker',
    env: process.env['NODE_ENV'] || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Module-specific child loggers
export const scannerLogger = logger.child({ module: 'scanner' });
export const analyzerLogger = logger.child({ module: 'analyzer' });
export const connectorLogger = logger.child({ module: 'connector' });
export const usageLogger = logger.child({ module: 'usage' });

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

/**
 * Create a child logger with correlation ID for request tracing
 */
export function createRequestLogger(correlationId?: string) {
  return logger.child({
    correlationId: correlationId || generateCorrelationId(),
  });
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context?: Record<string, unknown>
): void {
  const level = durationMs > 5000 ? 'warn' : 'info';
  logger[level]({ operation, durationMs, ...context }, `Performance: ${operation}`);
}

export default logger;
