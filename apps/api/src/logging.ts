import { pino } from 'pino';
import type { Level } from 'pino';

export interface LoggingOptions {
  level?: string;
}

export function createLogger(options: LoggingOptions = {}) {
  return pino({
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    base: { service: 'paypilot-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label as Level }),
    },
    // Pretty-print locally only; production stays JSON.
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss.l' },
          },
  });
}
