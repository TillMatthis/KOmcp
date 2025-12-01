import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config, isDevelopment } from './config/env';
import { logger } from './config/logger';
import { wellKnownRoutes } from './routes/well-known';
import { authMiddleware, requireScopes } from './middleware/auth';
import { RequiredScope } from './types/auth';

/**
 * Create and configure Fastify server instance
 */
export async function buildServer(): Promise<FastifyInstance> {
  // Create Fastify instance with logger configuration
  const server = Fastify({
    logger: isDevelopment
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
          level: config.LOG_LEVEL,
        }
      : {
          level: config.LOG_LEVEL,
        },
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true, // Trust X-Forwarded-* headers from reverse proxy
    bodyLimit: 1048576, // 1MB max body size
  });

  // Register CORS plugin
  await server.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Register Helmet plugin for security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  });

  // Register Rate Limit plugin
  await server.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    cache: 10000, // Cache 10k rate limit records
    allowList: ['127.0.0.1'], // Whitelist localhost
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    errorResponseBuilder: (_req, context) => {
      return {
        error: 'rate_limit_exceeded',
        error_description: `Too many requests. Limit: ${context.max} requests per ${
          config.RATE_LIMIT_WINDOW_MS / 1000
        } seconds.`,
        retry_after: Math.ceil(context.ttl / 1000),
      };
    },
  });

  // Register routes
  // Well-known OAuth endpoints (public, no auth required)
  await server.register(wellKnownRoutes);

  // Add custom API version header to all responses
  server.addHook('onSend', async (_request, reply) => {
    reply.header('X-API-Version', '1.0.0');
  });

  // Health check route (public, no auth required)
  server.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  });

  // Test protected endpoint (requires authentication)
  // This endpoint demonstrates OAuth middleware usage
  server.get(
    '/protected',
    {
      preHandler: [authMiddleware, requireScopes([RequiredScope.TOOLS_READ])],
    },
    async (request) => {
      return {
        message: 'You have successfully authenticated!',
        user: {
          userId: request.user!.userId,
          clientId: request.user!.clientId,
          scopes: request.user!.scopes,
        },
      };
    }
  );

  // Graceful shutdown handler
  const closeGracefully = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received signal, starting graceful shutdown');

    try {
      await server.close();
      logger.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));
  process.on('SIGINT', () => closeGracefully('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
  });

  return server;
}

/**
 * Start the Fastify server
 */
export async function startServer(server: FastifyInstance): Promise<void> {
  try {
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(
      {
        address: server.server.address(),
        routes: server.printRoutes(),
      },
      `Server listening on ${config.HOST}:${config.PORT}`
    );
  } catch (err) {
    logger.error({ err }, 'Error starting server');
    process.exit(1);
  }
}
