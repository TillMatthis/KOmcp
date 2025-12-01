# KOmcp Architecture

**Version:** 1.0
**Date:** 2025-12-01
**Project:** KOmcp - Remote MCP Server

---

## System Overview

KOmcp is a standalone HTTP server that implements the Model Context Protocol (MCP) specification, enabling Claude and other LLM applications to securely access Kura notes semantic search functionality via OAuth2-authenticated API calls.

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌─────────────┐
│   Claude    │────────▶│    KOmcp     │────────▶│   KOauth    │         │    Kura     │
│  (Web/App)  │  MCP    │  MCP Server  │  OAuth  │   OAuth2    │         │  Notes DB   │
│             │◀────────│   (HTTP)     │  Token  │   Server    │         │ (Postgres)  │
└─────────────┘         └──────────────┘  Valid  └─────────────┘         └─────────────┘
                               │                                                  │
                               │                                                  │
                               └──────────────────────────────────────────────────┘
                                        Read-Only Vector Search
```

---

## Architecture Principles

### 1. Separation of Concerns
- **Authentication:** Delegated to KOauth (OAuth2 server)
- **Data Storage:** Kura owns the notes database
- **Protocol:** KOmcp focuses solely on MCP implementation

### 2. Stateless Design
- No session state stored in KOmcp
- All authentication via stateless JWT tokens
- Horizontally scalable

### 3. Security First
- All endpoints require OAuth2 authentication (except public metadata)
- Read-only database access to Kura
- Input validation on all requests
- Rate limiting per client

### 4. Standards Compliance
- MCP Specification 2025-06-18
- OAuth 2.1 (RFC 6749 + security best practices)
- RFC 7591 (Dynamic Client Registration)
- RFC 9728 (Protected Resource Metadata)
- JSON-RPC 2.0 (RFC 4627)

---

## Technology Stack

### Core Framework: Fastify

**Why Fastify?**
- ✅ Fast (40% faster than Express)
- ✅ Native TypeScript support
- ✅ JSON schema validation (perfect for JSON-RPC)
- ✅ Plugin architecture (easy to extend)
- ✅ Low overhead (minimal memory footprint)
- ✅ Excellent logging (Pino built-in)
- ✅ HTTP/2 support

**Alternatives Considered:**
- ❌ Express: Slower, outdated, poor TypeScript support
- ❌ NestJS: Too heavy, unnecessary abstractions
- ❌ Hono: Too new, limited ecosystem

### Language: TypeScript 5.x

**Configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Database Access: Prisma 5.x

**Why Prisma?**
- ✅ Type-safe database queries
- ✅ Excellent TypeScript integration
- ✅ Connection pooling
- ✅ Migration support
- ✅ Native pgvector support

**Schema:**
```prisma
model Note {
  id         String   @id @default(uuid())
  user_id    String
  title      String
  content    String
  embedding  Unsupported("vector(1536)")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([user_id])
  @@index([embedding], type: Ivfflat)
}
```

### MCP Implementation: @modelcontextprotocol/sdk

**Official TypeScript SDK:**
- ✅ Implements MCP spec fully
- ✅ JSON-RPC 2.0 handling
- ✅ Type-safe tool definitions
- ✅ SSE support built-in

---

## Component Architecture

### Layer 1: HTTP Transport (Fastify)

```typescript
// src/server.ts
import Fastify from 'fastify';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});

// Plugins
await server.register(import('@fastify/cors'), { origin: process.env.ALLOWED_ORIGINS });
await server.register(import('@fastify/rate-limit'), { max: 100, timeWindow: '1 minute' });
await server.register(import('@fastify/helmet'), { contentSecurityPolicy: true });

// Routes
await server.register(healthRoutes);
await server.register(wellKnownRoutes);
await server.register(mcpRoutes);
```

### Layer 2: OAuth2 Middleware

```typescript
// src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../services/oauth';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'unauthorized',
      www_authenticate: {
        scheme: 'Bearer',
        resource_metadata: `${process.env.BASE_URL}/.well-known/oauth-protected-resource`
      }
    });
  }

  const token = authHeader.substring(7);

  try {
    const claims = await verifyToken(token);

    // Attach to request
    request.user = {
      userId: claims.sub,
      clientId: claims.client_id,
      scopes: claims.scope.split(' ')
    };
  } catch (error) {
    return reply.status(401).send({
      error: 'invalid_token',
      error_description: error.message
    });
  }
}
```

### Layer 3: MCP Protocol Handler

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'komcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          },
          logging: {}
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_kura_notes',
            description: 'Search Kura notes using semantic similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query text'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results (default: 10, max: 50)',
                  default: 10
                },
                min_similarity: {
                  type: 'number',
                  description: 'Minimum similarity threshold 0-1 (default: 0.7)',
                  default: 0.7
                }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;

      if (name === 'search_kura_notes') {
        const userId = extra.userId; // From auth middleware
        return await this.searchKuraNotes(userId, args);
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  private async searchKuraNotes(userId: string, args: any) {
    // Implementation in Layer 4
  }
}
```

### Layer 4: Kura Integration Service

```typescript
// src/services/kura.ts
import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './embeddings';

export class KuraSearchService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.KURA_DATABASE_URL
        }
      }
    });
  }

  async searchNotes(userId: string, query: string, limit = 10, minSimilarity = 0.7) {
    const startTime = Date.now();

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingTime = Date.now() - startTime;

    // Vector similarity search
    const searchStart = Date.now();
    const results = await this.prisma.$queryRaw`
      SELECT
        id,
        title,
        content,
        created_at,
        updated_at,
        1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM notes
      WHERE
        user_id = ${userId}
        AND 1 - (embedding <=> ${queryEmbedding}::vector) >= ${minSimilarity}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    `;
    const searchTime = Date.now() - searchStart;

    return {
      results,
      total: results.length,
      query_embedding_time_ms: embeddingTime,
      search_time_ms: searchTime
    };
  }
}
```

### Layer 5: OAuth2 Token Verification

```typescript
// src/services/oauth.ts
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: process.env.KOAUTH_JWKS_URL!,
  cache: true,
  cacheMaxAge: 3600000 // 1 hour
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface TokenClaims {
  sub: string;        // user_id
  client_id: string;
  scope: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export async function verifyToken(token: string): Promise<TokenClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.BASE_URL,
        issuer: process.env.KOAUTH_URL,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }

        const claims = decoded as TokenClaims;

        // Verify required scopes
        const scopes = claims.scope.split(' ');
        const requiredScopes = ['mcp:tools:read', 'mcp:tools:execute'];

        if (!requiredScopes.every(s => scopes.includes(s))) {
          reject(new Error('Insufficient scopes'));
          return;
        }

        resolve(claims);
      }
    );
  });
}
```

---

## Directory Structure

```
komcp/
├── src/
│   ├── server.ts                 # Main Fastify server setup
│   ├── config/
│   │   ├── env.ts               # Environment variable validation
│   │   └── logger.ts            # Logger configuration
│   ├── middleware/
│   │   ├── auth.ts              # OAuth2 token validation middleware
│   │   └── error.ts             # Error handling middleware
│   ├── routes/
│   │   ├── health.ts            # Health check endpoint
│   │   ├── well-known.ts        # OAuth metadata endpoint
│   │   └── mcp.ts               # MCP JSON-RPC endpoint
│   ├── mcp/
│   │   ├── server.ts            # MCP server implementation
│   │   ├── tools/
│   │   │   └── search-notes.ts  # Search tool implementation
│   │   └── schemas.ts           # Tool schemas
│   ├── services/
│   │   ├── oauth.ts             # OAuth token verification
│   │   ├── kura.ts              # Kura database queries
│   │   └── embeddings.ts        # Embedding generation
│   └── types/
│       ├── mcp.ts               # MCP type definitions
│       └── auth.ts              # Auth type definitions
├── prisma/
│   └── schema.prisma            # Database schema
├── tests/
│   ├── unit/
│   │   ├── oauth.test.ts
│   │   └── kura.test.ts
│   └── integration/
│       └── mcp-flow.test.ts     # End-to-end MCP tests
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

---

## Request Flow

### 1. Tool Discovery Flow

```
┌────────┐         ┌────────┐         ┌─────────┐         ┌────────┐
│ Claude │         │ KOmcp  │         │ KOauth  │         │  Kura  │
└───┬────┘         └───┬────┘         └────┬────┘         └───┬────┘
    │                  │                   │                   │
    │ POST /mcp        │                   │                   │
    │ tools/list       │                   │                   │
    │ (no auth)        │                   │                   │
    ├─────────────────▶│                   │                   │
    │                  │                   │                   │
    │ 401 + WWW-Auth   │                   │                   │
    │◀─────────────────┤                   │                   │
    │                  │                   │                   │
    │ GET /.well-known │                   │                   │
    │◀─────────────────┤                   │                   │
    │                  │                   │                   │
    │ OAuth Flow       │                   │                   │
    ├──────────────────┼──────────────────▶│                   │
    │                  │                   │                   │
    │ access_token     │                   │                   │
    │◀─────────────────┼───────────────────┤                   │
    │                  │                   │                   │
    │ POST /mcp        │                   │                   │
    │ tools/list       │                   │                   │
    │ + Bearer token   │                   │                   │
    ├─────────────────▶│                   │                   │
    │                  │                   │                   │
    │                  │ Verify token      │                   │
    │                  ├──────────────────▶│                   │
    │                  │ (JWKS)            │                   │
    │                  │◀──────────────────┤                   │
    │                  │                   │                   │
    │ { tools: [...] } │                   │                   │
    │◀─────────────────┤                   │                   │
    │                  │                   │                   │
```

### 2. Tool Execution Flow

```
┌────────┐         ┌────────┐         ┌─────────┐         ┌────────┐
│ Claude │         │ KOmcp  │         │ KOauth  │         │  Kura  │
└───┬────┘         └───┬────┘         └────┬────┘         └───┬────┘
    │                  │                   │                   │
    │ POST /mcp        │                   │                   │
    │ tools/call       │                   │                   │
    │ search_kura_notes│                   │                   │
    │ + Bearer token   │                   │                   │
    ├─────────────────▶│                   │                   │
    │                  │                   │                   │
    │                  │ Verify token      │                   │
    │                  ├──────────────────▶│                   │
    │                  │◀──────────────────┤                   │
    │                  │                   │                   │
    │                  │ Generate embedding│                   │
    │                  │ (internal)        │                   │
    │                  │                   │                   │
    │                  │ Vector search     │                   │
    │                  ├───────────────────┼──────────────────▶│
    │                  │                   │                   │
    │                  │ Results           │                   │
    │                  │◀──────────────────┼───────────────────┤
    │                  │                   │                   │
    │ { results: [...] }                   │                   │
    │◀─────────────────┤                   │                   │
    │                  │                   │                   │
```

---

## Configuration Management

### Environment-Based Config

```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3003),
  HOST: z.string().default('0.0.0.0'),

  // KOauth
  KOAUTH_URL: z.string().url(),
  KOAUTH_JWKS_URL: z.string().url(),
  KOAUTH_CLIENT_REGISTRATION_URL: z.string().url(),

  // Kura
  KURA_DATABASE_URL: z.string(),

  // Security
  ALLOWED_ORIGINS: z.string().default('https://claude.ai'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Base URL (for OAuth audience)
  BASE_URL: z.string().url()
});

export const config = envSchema.parse(process.env);
```

---

## Error Handling

### Error Types

```typescript
// src/types/errors.ts
export class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class UnauthorizedError extends MCPError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class InvalidToolError extends MCPError {
  constructor(toolName: string) {
    super(-32601, `Unknown tool: ${toolName}`);
  }
}
```

### Error Handler Middleware

```typescript
// src/middleware/error.ts
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { MCPError } from '../types/errors';

export function errorHandler(
  error: FastifyError | MCPError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  if (error instanceof MCPError) {
    return reply.status(200).send({
      jsonrpc: '2.0',
      error: {
        code: error.code,
        message: error.message,
        data: error.data
      },
      id: request.body?.id || null
    });
  }

  // Fastify errors
  return reply.status(error.statusCode || 500).send({
    error: 'internal_server_error',
    message: error.message
  });
}
```

---

## Security Considerations

### 1. Token Validation
- JWT signature verification via JWKS
- Token expiration checks
- Scope validation
- Audience and issuer validation

### 2. Database Security
- Read-only database user for Kura
- Parameterized queries (Prisma)
- Row-level security (filter by user_id)
- Connection pooling limits

### 3. Input Validation
- JSON schema validation for all MCP requests
- Query parameter sanitization
- Content length limits
- Rate limiting per client_id

### 4. Network Security
- HTTPS only (TLS 1.3)
- CORS restrictions
- Security headers (Helmet)
- No sensitive data in logs

### 5. Secrets Management
- Environment variables for secrets
- No secrets in code/repo
- Docker secrets in production
- Regular secret rotation

---

## Deployment Architecture

### Docker Compose Stack

```yaml
version: '3.8'

services:
  komcp:
    build: ./docker
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - KOAUTH_URL=https://auth.example.com
      - KURA_DATABASE_URL=postgresql://komcp_ro:pwd@kura-db:5432/kura
    depends_on:
      - kura-db
    restart: unless-stopped
    networks:
      - komcp-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - komcp
    networks:
      - komcp-network

networks:
  komcp-network:
    driver: bridge
```

### Nginx Configuration

```nginx
upstream komcp {
    server komcp:3003;
}

server {
    listen 443 ssl http2;
    server_name mcp.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.3;

    location / {
        proxy_pass http://komcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Monitoring & Observability

### Health Check Endpoint

```typescript
// src/routes/health.ts
export async function healthRoutes(server: FastifyInstance) {
  server.get('/health', async (request, reply) => {
    const dbHealthy = await checkDatabaseConnection();
    const koauthHealthy = await checkKOauthConnection();

    if (dbHealthy && koauthHealthy) {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      };
    }

    reply.status(503);
    return {
      status: 'unhealthy',
      checks: {
        database: dbHealthy ? 'ok' : 'failed',
        koauth: koauthHealthy ? 'ok' : 'failed'
      }
    };
  });
}
```

### Structured Logging

```typescript
// src/config/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        authorization: '[REDACTED]' // Never log tokens
      }
    })
  }
});
```

---

## Performance Optimization

### 1. Connection Pooling
```typescript
// Prisma connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.KURA_DATABASE_URL
    }
  },
  // Pool size
  connection_limit: 10
});
```

### 2. JWKS Caching
```typescript
// Cache public keys for 1 hour
const client = jwksClient({
  jwksUri: process.env.KOAUTH_JWKS_URL!,
  cache: true,
  cacheMaxAge: 3600000
});
```

### 3. Query Optimization
```sql
-- Create index on user_id and vector column
CREATE INDEX idx_notes_user_embedding ON notes USING ivfflat (embedding vector_cosine_ops)
WHERE user_id IS NOT NULL;
```

---

## Testing Strategy

### Unit Tests
- OAuth token verification logic
- MCP tool schema validation
- Input sanitization
- Error handling

### Integration Tests
- Full MCP flow (discover → authorize → execute)
- Database queries
- OAuth flow with KOauth
- Rate limiting behavior

### Load Tests
- 100+ concurrent users
- Tool execution under load
- Database connection pooling
- Memory/CPU usage

---

## Key Design Decisions

### ✅ Fastify over Express
**Reason:** Better performance, native TypeScript support, JSON schema validation

### ✅ Prisma over TypeORM
**Reason:** Better type safety, simpler API, excellent PostgreSQL support

### ✅ Read-only Kura access
**Reason:** Security, prevents accidental data modification, allows shared DB access

### ✅ Stateless JWT validation
**Reason:** Horizontal scalability, no session storage needed

### ✅ Single tool in MVP
**Reason:** Prove the concept, iterate based on usage

### ✅ HTTP + SSE transport
**Reason:** Standard for remote MCP servers, works with Claude web

---

## Future Architecture Considerations

### Caching Layer (Redis)
- Cache frequent searches
- Cache JWKS keys
- Rate limiting state

### Horizontal Scaling
- Multiple KOmcp instances behind load balancer
- Shared rate limiting state (Redis)
- Health check-based routing

### Observability
- OpenTelemetry tracing
- Prometheus metrics
- Grafana dashboards
- Error tracking (Sentry)

---

## References

- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)

---

**Last Updated:** 2025-12-01
