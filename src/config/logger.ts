import pino from 'pino';
import { config, isDevelopment } from './env';

/**
 * Custom serializers to sanitize sensitive data from logs
 */
const serializers = {
  /**
   * Sanitize HTTP request logs
   * Remove sensitive headers like Authorization
   */
  req: (req: any) => {
    if (!req) return req;

    const sanitizedHeaders = { ...req.headers };

    // Remove sensitive headers
    if (sanitizedHeaders.authorization) {
      sanitizedHeaders.authorization = '[REDACTED]';
    }
    if (sanitizedHeaders.cookie) {
      sanitizedHeaders.cookie = '[REDACTED]';
    }

    return {
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: sanitizedHeaders,
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort,
    };
  },

  /**
   * Sanitize HTTP response logs
   */
  res: (res: any) => {
    if (!res) return res;

    return {
      statusCode: res.statusCode,
      headers: res.getHeaders?.(),
    };
  },

  /**
   * Sanitize error logs
   * Include stack trace but remove sensitive data
   */
  err: pino.stdSerializers.err,
};

/**
 * Create Pino logger instance with appropriate configuration
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  serializers,

  // Development: Pretty print with colors
  // Production: JSON format for log aggregation
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            singleLine: false,
            messageFormat: '{levelLabel} - {msg}',
          },
        },
      }
    : {
        // Production format
        formatters: {
          level: (label: string) => {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),

  // Base fields included in every log
  base: {
    env: config.NODE_ENV,
    ...(isDevelopment ? {} : { pid: process.pid, hostname: require('os').hostname() }),
  },
});

/**
 * Create child logger with additional context
 * @param bindings - Additional fields to include in logs
 * @returns Child logger instance
 */
export function createLogger(bindings: Record<string, any>): pino.Logger {
  return logger.child(bindings);
}

/**
 * Log startup information
 */
export function logStartup(): void {
  logger.info(
    {
      config: {
        nodeEnv: config.NODE_ENV,
        port: config.PORT,
        host: config.HOST,
        baseUrl: config.BASE_URL,
        logLevel: config.LOG_LEVEL,
      },
    },
    'Starting KOmcp MCP Server'
  );
}

/**
 * Log shutdown information
 */
export function logShutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down KOmcp MCP Server');
}
