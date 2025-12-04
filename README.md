# KOmcp

**Remote MCP Server for Kura Notes Management**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## Overview

KOmcp is a standalone remote MCP (Model Context Protocol) server that enables Claude and other LLM applications to securely **create, search, retrieve, and manage Kura notes** via OAuth2-authenticated API calls.

### What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard developed by Anthropic for connecting AI assistants to external data sources and tools. KOmcp implements this protocol to expose Kura's semantic search as a tool that Claude can use.

### Key Features

- ✅ **MCP Protocol Compliance:** Implements MCP specification (2025-06-18)
- 🔒 **OAuth2 Authentication:** Integrates with KOauth for secure, token-based authentication
- 🔍 **Semantic Search:** Leverages Kura's vector-powered semantic search
- ✏️ **Full CRUD Operations:** Create, read, list, and delete notes via Kura API
- 🚀 **Claude Web Connector:** Works seamlessly with Claude's custom connector feature
- 🐳 **Docker Deployment:** Production-ready containerized deployment
- 📊 **Type-Safe:** Built with TypeScript for reliability and maintainability

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌─────────────┐
│   Claude    │────────▶│    KOmcp     │────────▶│   KOauth    │         │    Kura     │
│  (Web/App)  │  MCP    │  MCP Server  │  OAuth  │   OAuth2    │         │   Notes     │
│             │◀────────│   (HTTP)     │  Token  │   Server    │         │   API       │
└─────────────┘         └──────────────┘  Valid  └─────────────┘         └─────────────┘
                               │                                                  │
                               └──────────────────────────────────────────────────┘
                                    Full API Access (Search, CRUD)
```

### Components

1. **KOmcp (This Project):** MCP server exposing Kura operations as MCP tools
2. **KOauth:** OAuth2 server for authentication ([github.com/TillMatthis/KOauth](https://github.com/TillMatthis/KOauth))
3. **Kura:** Note-taking application with semantic search and API
4. **Claude:** LLM client that discovers and uses the tools

---

## Technology Stack

- **Runtime:** Node.js 20 (LTS)
- **Language:** TypeScript 5.x (strict mode)
- **Web Framework:** Fastify 4.x
- **Database ORM:** Prisma 5.x
- **Database:** PostgreSQL 15+ with pgvector extension
- **MCP SDK:** `@modelcontextprotocol/sdk` (official TypeScript SDK)
- **OAuth:** JWT validation with `jsonwebtoken` + `jwks-rsa`
- **Deployment:** Docker + Docker Compose + Nginx

---

## Prerequisites

- **Node.js:** 20.x or higher
- **npm:** 9.x or higher
- **KOauth:** Running OAuth2 server with RFC 7591 (Dynamic Client Registration) support
- **Kura:** Running Kura instance with API enabled
- **Docker:** (optional) For containerized deployment

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/TillMatthis/KOmcp.git
cd KOmcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server
NODE_ENV=development
PORT=3003
HOST=0.0.0.0
BASE_URL=http://localhost:3003

# KOauth Integration
KOAUTH_URL=https://auth.example.com
KOAUTH_JWKS_URL=https://auth.example.com/.well-known/jwks.json
KOAUTH_CLIENT_REGISTRATION_URL=https://auth.example.com/oauth/register

# Kura API
KURA_URL=https://kura.tillmaessen.de

# Security
ALLOWED_ORIGINS=https://claude.ai
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3003`

### 5. Verify Health

```bash
curl http://localhost:3003/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-01T12:00:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

---

## Docker Deployment

### Production Deployment

Build and run with Docker Compose:

```bash
# Build and start
npm run docker:prod:build

# Or manually
docker-compose up -d --build

# View logs
npm run docker:logs

# Stop
npm run docker:stop
```

Server will be available at `http://localhost:3003`

### Development with Docker

Run with hot reload:

```bash
# Start development container
npm run docker:dev:build

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

Changes to `src/` will automatically reload the server.

### Docker Environment

Create `.env` file (same as Quick Start step 3) before running Docker.

The Docker container:
- Runs as non-root user (nodejs:1001)
- Uses multi-stage build for minimal image size
- Includes health checks
- Resource limits: 512MB RAM, 1 CPU
- Automatic restarts

### Building for VPS Deployment

```bash
# Build production image
docker build -t komcp:latest .

# Tag for registry
docker tag komcp:latest registry.example.com/komcp:latest

# Push to registry
docker push registry.example.com/komcp:latest
```

See `docs/deployment-guide.md` for complete VPS deployment instructions with Nginx and SSL.

---

## Usage

### Adding KOmcp to Claude

1. Open Claude (web or desktop)
2. Go to Settings → Integrations → Custom Connectors
3. Click "Add Custom Connector"
4. Enter your KOmcp server URL: `https://mcp.example.com`
5. Complete OAuth2 authorization via KOauth
6. Claude will discover all available Kura tools

### Using in Claude

Once connected, you can ask Claude to:

- **Search:** "Search my notes for information about machine learning"
- **Create:** "Create a note about today's meeting with the team"
- **View:** "Show me the full content of note xyz-123"
- **List:** "What are my most recent notes?"
- **Delete:** "Delete the note with ID abc-456"

Claude will automatically use the appropriate tools to manage your Kura notes.

### Available Tools

#### `search_kura_notes`

Search Kura notes using semantic similarity. Finds notes that are conceptually related to the search query, even if they don't contain the exact keywords.

**Parameters:**
- `query` (string, required): Natural language search query
- `limit` (number, optional): Maximum results (1-50, default: 10)
- `min_similarity` (number, optional): Similarity threshold 0-1 (default: 0.7)

**Example:**
```
Search for "docker deployment best practices"
```

#### `create_note`

Create a new note in Kura with content, optional title, annotations, and tags.

**Parameters:**
- `content` (string, required): The note content (max 100,000 characters)
- `title` (string, optional): Note title (auto-generated if not provided)
- `annotation` (string, optional): Additional context or metadata
- `tags` (array of strings, optional): Tags for organization
- `contentType` (string, optional): Content type hint (default: "text")

**Example:**
```
Create a note with content "Deploy using docker-compose up -d",
title "Docker Deployment", and tags ["docker", "devops"]
```

#### `get_note`

Retrieve the full content of a specific note by its ID.

**Parameters:**
- `note_id` (string, required): The unique ID of the note

**Example:**
```
Get note with ID "abc-123-def-456"
```

#### `list_recent_notes`

List the 20 most recently created or updated notes (summary view without full content).

**Parameters:** None

**Example:**
```
Show my recent notes
```

#### `delete_note`

Permanently delete a note by its ID. This action cannot be undone.

**Parameters:**
- `note_id` (string, required): The unique ID of the note to delete

**Example:**
```
Delete note with ID "abc-123-def-456"
```

---

## API Endpoints

### Public Endpoints (No Auth)

- `GET /health` - Health check
- `GET /.well-known/oauth-protected-resource` - OAuth metadata for Dynamic Client Registration

### Protected Endpoints (Requires OAuth Token)

- `POST /mcp` - Main MCP endpoint (JSON-RPC 2.0)
  - Method: `tools/list` - List available tools
  - Method: `tools/call` - Execute a tool

---

## Development

### Project Structure

```
komcp/
├── src/
│   ├── server.ts              # Main Fastify server
│   ├── config/                # Configuration (env, logger)
│   ├── middleware/            # Auth, error handling, metrics
│   ├── routes/                # HTTP routes (health, mcp)
│   ├── mcp/                   # MCP server implementation
│   │   └── tools/            # Tool implementations
│   ├── services/              # Business logic (oauth, kura, embeddings)
│   └── types/                 # TypeScript types
├── prisma/
│   └── schema.prisma          # Database schema
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/                      # Additional documentation
├── komcp-prd.md              # Product Requirements Document
├── architecture.md            # Architecture documentation
├── BUILD-CHECKLIST.md         # Implementation checklist
├── CLAUDE-CODE-RULES.md       # Development rules
└── README.md                  # This file
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build TypeScript
npm start            # Start production server

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run typecheck    # Check TypeScript types

# Database
npx prisma generate  # Generate Prisma client
npx prisma studio    # Open database GUI
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- oauth.test.ts

# Run with coverage
npm run test:coverage
```

---

## Docker Deployment

### Build Image

```bash
docker build -f docker/Dockerfile -t komcp:latest .
```

### Run with Docker Compose

```bash
cd docker
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f komcp
```

### Stop Services

```bash
docker-compose down
```

---

## Production Deployment

See [BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md) Phase 10 for complete deployment guide.

### Quick Production Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database read-only user created
- [ ] KOauth supports Dynamic Client Registration
- [ ] Health checks configured
- [ ] Monitoring/alerting set up
- [ ] Backup plan documented

---

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `KOAUTH_URL` - KOauth OAuth2 server URL
- `KOAUTH_JWKS_URL` - JWKS endpoint for token verification
- `KURA_URL` - Kura API base URL
- `BASE_URL` - Public URL of this server

**Optional:**
- `PORT` - Server port (default: 3003)
- `LOG_LEVEL` - Log level: debug, info, warn, error (default: info)
- `RATE_LIMIT_MAX` - Max requests per window (default: 100)
- `ALLOWED_ORIGINS` - CORS allowed origins (default: https://claude.ai)

---

## Security

### OAuth2 Flow

1. Claude sends request without token → KOmcp returns 401
2. Claude discovers OAuth endpoints via `/.well-known/oauth-protected-resource`
3. Claude registers dynamically with KOauth (RFC 7591)
4. User authorizes via KOauth web UI
5. Claude receives access token
6. Claude sends MCP requests with `Authorization: Bearer <token>` header
7. KOmcp validates token via JWKS and checks scopes

### Required Scopes

- `mcp:tools:read` - List available tools
- `mcp:tools:execute` - Execute tools
- `kura:notes:read` - Read Kura notes (search, get, list)
- `kura:notes:write` - Write Kura notes (create)
- `kura:notes:delete` - Delete Kura notes

### Security Features

- ✅ HTTPS only (TLS 1.3)
- ✅ OAuth2 token validation on every request
- ✅ JWT signature verification via JWKS
- ✅ Scope validation
- ✅ Rate limiting per client
- ✅ Read-only database access
- ✅ Parameterized queries (SQL injection prevention)
- ✅ No sensitive data in logs
- ✅ Security headers (HSTS, CSP, etc.)

---

## Troubleshooting

### Server Won't Start

**Check environment variables:**
```bash
npm run dev
# Look for "Environment validation failed" errors
```

**Check database connection:**
```bash
npx prisma db pull
```

### OAuth Token Validation Fails

**Check JWKS endpoint reachable:**
```bash
curl https://auth.example.com/.well-known/jwks.json
```

**Check token format:**
```bash
# Token should be: Authorization: Bearer <jwt>
# Verify token is valid JWT at jwt.io
```

### Search Returns No Results

**Check database has notes:**
```sql
SELECT COUNT(*) FROM notes WHERE user_id = 'your-user-id';
```

**Check embeddings exist:**
```sql
SELECT COUNT(*) FROM notes WHERE embedding IS NOT NULL;
```

**Lower similarity threshold:**
```typescript
// Try min_similarity: 0.5 instead of 0.7
```

### Claude Can't Connect

**Check server is publicly accessible:**
```bash
curl https://mcp.example.com/health
```

**Check CORS configuration:**
```env
ALLOWED_ORIGINS=https://claude.ai
```

**Check OAuth metadata endpoint:**
```bash
curl https://mcp.example.com/.well-known/oauth-protected-resource
```

---

## Documentation

- **[komcp-prd.md](./komcp-prd.md)** - Product Requirements Document (MVP scope, features, success criteria)
- **[architecture.md](./architecture.md)** - Technical architecture and design decisions
- **[BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md)** - Phased implementation tasks
- **[CLAUDE-CODE-RULES.md](./CLAUDE-CODE-RULES.md)** - Development rules and best practices

### External References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude MCP Connector Documentation](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector)
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow [CLAUDE-CODE-RULES.md](./CLAUDE-CODE-RULES.md)
4. Write tests for new features
5. Ensure all tests pass: `npm test`
6. Commit with conventional commit format: `feat: add new feature`
7. Push to your fork and submit a pull request

---

## Roadmap

### Phase 1 - MVP ✅ Complete
- ✅ OAuth2 token validation
- ✅ Dynamic Client Registration
- ✅ Docker deployment
- ✅ `search_kura_notes` tool

### Phase 2 - Full API Integration ✅ Complete
- ✅ `create_note` tool
- ✅ `get_note` tool
- ✅ `list_recent_notes` tool
- ✅ `delete_note` tool
- ✅ Kura API client integration

### Phase 3 - Advanced Features (Planned)
- `update_note` tool
- Real-time updates via SSE
- MCP Resources (expose notes as resources)
- MCP Prompts (templated queries)
- Advanced search filters (tags, date ranges)
- Caching layer (Redis)

### Phase 4 - Operations (Planned)
- Monitoring dashboard
- Usage analytics
- Multi-region deployment

---

## License

MIT License - See [LICENSE](./LICENSE) for details

---

## Support

- **Issues:** [GitHub Issues](https://github.com/TillMatthis/KOmcp/issues)
- **Documentation:** See `docs/` directory
- **Email:** [Your support email]

---

## Acknowledgments

- [Anthropic](https://www.anthropic.com) for the MCP specification
- [KOauth](https://github.com/TillMatthis/KOauth) for OAuth2 infrastructure
- Kura notes application for semantic search capabilities

---

**Status:** ✅ Phase 2 Complete - Full API Integration

**Last Updated:** 2025-12-04
