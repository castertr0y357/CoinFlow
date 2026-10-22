export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_HIERARCHY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

// Global state to allow runtime toggling without container restarts
declare global {
  // eslint-disable-next-line no-var
  var __COINFLOW_DEBUG_LOGGING__: boolean | undefined;
}

export function isDebugEnabled(): boolean {
  if (typeof globalThis.__COINFLOW_DEBUG_LOGGING__ === 'boolean') {
    return globalThis.__COINFLOW_DEBUG_LOGGING__;
  }
  return process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG' || process.env.DEBUG_LOGGING?.toLowerCase() === 'true';
}

export function setDebugLogging(enabled: boolean): void {
  globalThis.__COINFLOW_DEBUG_LOGGING__ = enabled;
  logger.info('OBSERVABILITY', `Runtime debug logging set to ${enabled}`);
}

interface LogOptions {
  action?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

function emitLog(level: LogLevel, job: string, message: string, opts?: LogOptions) {
  const currentLevelNum = isDebugEnabled()
    ? LOG_LEVEL_HIERARCHY.DEBUG
    : (LOG_LEVEL_HIERARCHY[(process.env.LOG_LEVEL?.toUpperCase() as LogLevel)] || LOG_LEVEL_HIERARCHY.INFO);

  if (LOG_LEVEL_HIERARCHY[level] < currentLevelNum) {
    return;
  }

  const isPretty = process.env.CONSOLE_PRETTY === 'true' || process.env.NODE_ENV === 'development';
  const timestamp = new Date().toISOString();
  const detail = opts?.error instanceof Error ? opts.error.stack || opts.error.message : opts?.error ? String(opts.error) : undefined;

  if (isPretty) {
    const cidStr = opts?.correlationId ? `[${opts.correlationId}] ` : '';
    const formatted = `[${timestamp}] ${cidStr}[${job}] - ${level} - ${message}${detail ? `\n${detail}` : ''}`;
    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  } else {
    // Single-line JSON optimized for Promtail / Loki ingestion
    const logEntry = {
      timestamp,
      level,
      app: 'coinflow',
      logger: job,
      action: opts?.action || job,
      correlation_id: opts?.correlationId || 'none',
      message: detail ? `${message}: ${detail}` : message,
      ...(opts?.context ? { context: opts.context } : {}),
      ...(opts?.error && opts.error instanceof Error ? { stack: opts.error.stack } : {}),
    };
    process.stdout.write(JSON.stringify(logEntry) + '\n');
  }
}

export const logger = {
  debug: (job: string, message: string, opts?: LogOptions) => emitLog('DEBUG', job, message, opts),
  info: (job: string, message: string, opts?: LogOptions) => emitLog('INFO', job, message, opts),
  warn: (job: string, message: string, opts?: LogOptions) => emitLog('WARN', job, message, opts),
  error: (job: string, message: string, error?: unknown, opts?: Omit<LogOptions, 'error'>) =>
    emitLog('ERROR', job, message, { ...opts, error }),
};

// In-Memory Prometheus Metrics Registry for CoinFlow
class CoinFlowMetrics {
  private requestsTotal: Map<string, number> = new Map();
  private actionsTotal: Map<string, number> = new Map();
  private startTime: number = Date.now();

  recordRequest(method: string, path: string, status: number): void {
    // Normalize path to prevent metric cardinality explosion
    let normalized = path.split('?')[0];
    if (normalized.startsWith('/api/v1/sync/status/')) normalized = '/api/v1/sync/status/[id]';
    if (normalized.startsWith('/api/v1/data/backups/')) normalized = '/api/v1/data/backups/[filename]';

    const key = `coinflow_http_requests_total{method="${method}",path="${normalized}",status="${status}"}`;
    this.requestsTotal.set(key, (this.requestsTotal.get(key) || 0) + 1);
  }

  recordAction(action: string, status: 'success' | 'failure' = 'success'): void {
    const key = `coinflow_actions_total{action="${action}",status="${status}"}`;
    this.actionsTotal.set(key, (this.actionsTotal.get(key) || 0) + 1);
  }

  generateMetrics(): string {
    const uptimeSec = Math.round((Date.now() - this.startTime) / 1000);
    const lines: string[] = [
      '# HELP coinflow_uptime_seconds Process uptime in seconds',
      '# TYPE coinflow_uptime_seconds gauge',
      `coinflow_uptime_seconds ${uptimeSec}`,
      '# HELP coinflow_http_requests_total Total HTTP requests handled by CoinFlow',
      '# TYPE coinflow_http_requests_total counter',
    ];

    for (const [k, v] of this.requestsTotal.entries()) {
      lines.push(`${k} ${v}`);
    }

    lines.push('# HELP coinflow_actions_total Total domain actions executed');
    lines.push('# TYPE coinflow_actions_total counter');
    for (const [k, v] of this.actionsTotal.entries()) {
      lines.push(`${k} ${v}`);
    }

    return lines.join('\n') + '\n';
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __COINFLOW_METRICS__: CoinFlowMetrics | undefined;
}

export const metrics = globalThis.__COINFLOW_METRICS__ || (globalThis.__COINFLOW_METRICS__ = new CoinFlowMetrics());
