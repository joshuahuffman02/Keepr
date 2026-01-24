/**
 * Production-ready Logger
 * Replaces console.* calls with environment-aware logging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const parseLogLevel = (value: string | undefined): LogLevel | undefined => {
  if (!value) return undefined;
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return undefined;
};

/**
 * Get minimum log level from environment
 */
function getMinLevel(): number {
  const envLevel = parseLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase());
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  // Default: debug in dev, warn in production
  return process.env.NODE_ENV === "production" ? LOG_LEVELS.warn : LOG_LEVELS.debug;
}

const minLevel = getMinLevel();

/**
 * Check if logging is enabled for a level
 */
function isEnabled(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

/**
 * Format log entry for console output
 */
function formatForConsole(entry: LogEntry): Array<string | unknown> {
  const prefix = `[${entry.context || "app"}]`;
  const parts: Array<string | unknown> = [prefix, entry.message];
  return parts;
}

/**
 * Send log entry to remote service (production only)
 */
function sendToRemote(entry: LogEntry): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") {
    return;
  }

  // Only send errors and warnings in production
  if (entry.level !== "error" && entry.level !== "warn") {
    return;
  }

  try {
    const body = JSON.stringify(entry);

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/logs", body);
    } else {
      fetch("/api/logs", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      }).catch(() => {
        // Silently fail
      });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, context?: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log to console with appropriate method
 */
function logToConsole(entry: LogEntry): void {
  const args = formatForConsole(entry);

  if (entry.data !== undefined) {
    args.push(entry.data);
  }

  switch (entry.level) {
    case "debug":
      console.debug(...args);
      break;
    case "info":
      console.info(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      break;
  }
}

/**
 * Main log function
 */
function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!isEnabled(level)) {
    return;
  }

  const entry = createEntry(level, message, context, data);
  logToConsole(entry);
  sendToRemote(entry);
}

/**
 * Logger interface
 */
export const logger = {
  debug: (message: string, data?: unknown) => log("debug", message, undefined, data),
  info: (message: string, data?: unknown) => log("info", message, undefined, data),
  warn: (message: string, data?: unknown) => log("warn", message, undefined, data),
  error: (message: string, data?: unknown) => log("error", message, undefined, data),

  /**
   * Create a scoped logger with a context prefix
   */
  scope: (context: string) => ({
    debug: (message: string, data?: unknown) => log("debug", message, context, data),
    info: (message: string, data?: unknown) => log("info", message, context, data),
    warn: (message: string, data?: unknown) => log("warn", message, context, data),
    error: (message: string, data?: unknown) => log("error", message, context, data),
  }),
};

/**
 * Create a scoped logger for a specific module
 */
export function createLogger(context: string) {
  return logger.scope(context);
}

/**
 * Error boundary logging helper
 */
export function logError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  log("error", message, context, { stack, error });
}

/**
 * Performance timing helper
 */
export function logTiming(name: string, duration: number, context?: string): void {
  log("debug", `${name} took ${duration.toFixed(2)}ms`, context || "perf");
}

// Export default logger
export default logger;
