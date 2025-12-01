# KOmcp Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2025-12-01
**Status:** Draft
**Project:** KOmcp - Remote MCP Server for Kura Notes Semantic Search

---

## Executive Summary

KOmcp is a standalone remote MCP (Model Context Protocol) server that enables Claude and other LLM applications to securely access Kura notes semantic search functionality via the standardized MCP protocol. It integrates with the existing KOauth OAuth2 infrastructure for authentication and authorization.

### Primary Goal
**Enable Claude web connector to securely search Kura notes using MCP protocol with OAuth2 authentication.**

---

## Problem Statement

Users need to provide Claude (and potentially other LLMs) secure, authenticated access to their Kura notes semantic search capabilities without:
- Exposing sensitive note data
- Managing separate authentication systems
- Requiring complex manual setup
- Compromising security

---

## Solution Overview

Build a production-ready remote MCP server that:
1. Implements the Model Context Protocol specification (2025-06-18)
2. Exposes Kura's semantic search as an MCP tool
3. Uses KOauth OAuth2 for authentication (OAuth 2.1 + RFC 7591 Dynamic Client Registration)
4. Validates access tokens on every request
5. Deploys securely on VPS alongside KOauth and Kura

---

## Technical Requirements

### 1. MCP Protocol Implementation

#### Core Protocol
- **Transport:** HTTP with Server-Sent Events (SSE) support
- **Message Format:** JSON-RPC 2.0
- **Protocol Version:** 2025-06-18 (latest stable)

#### Required MCP Endpoints
1. **Resource Metadata Endpoint** (RFC 9728)
   - Path: `/.well-known/oauth-protected-resource`
   - Returns OAuth configuration for Dynamic Client Registration
   - Includes authorization server URL, scopes, etc.

2. **Tools Discovery** (`tools/list`)
   - Lists available MCP tools
   - Returns tool schemas with input/output definitions
   - Requires valid OAuth token

3. **Tool Execution** (`tools/call`)
   - Executes requested tool
   - Validates authorization
   - Returns structured results

#### MCP Capabilities
```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    },
    "logging": {}
  }
}
```

### 2. OAuth 2.1 Integration with KOauth

#### Authentication Flow
1. Claude initiates connection to KOmcp
2. KOmcp returns 401 with `WWW-Authenticate` header containing resource metadata URL
3. Claude discovers OAuth endpoints via resource metadata
4. Claude performs Dynamic Client Registration (RFC 7591) with KOauth
5. User authorizes via KOauth OAuth2 flow
6. Claude receives access token
7. Claude sends MCP requests with `Authorization: Bearer <token>` header

#### Token Validation
- Validate JWT signature using KOauth's JWKS endpoint
- Verify token claims (expiration, issuer, audience, scopes)
- Check required scopes: `mcp:tools:read`, `mcp:tools:execute`, `kura:notes:search`
- Middleware applies to all protected endpoints

#### Security Requirements
- All requests require valid OAuth2 access token
- Token refresh handled by Claude (per MCP spec)
- Rate limiting per client_id
- Audit logging of all tool executions

### 3. Kura Integration

#### Semantic Search Tool

**Tool Name:** `search_kura_notes`

**Description:** Search Kura notes using semantic similarity (vector embeddings)

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query text"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results (default: 10, max: 50)",
      "default": 10
    },
    "min_similarity": {
      "type": "number",
      "description": "Minimum similarity threshold 0-1 (default: 0.7)",
      "default": 0.7
    }
  },
  "required": ["query"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "content": { "type": "string" },
          "similarity": { "type": "number" },
          "created_at": { "type": "string" },
          "updated_at": { "type": "string" }
        }
      }
    },
    "total": { "type": "number" },
    "query_embedding_time_ms": { "type": "number" },
    "search_time_ms": { "type": "number" }
  }
}
```

#### Integration Method
- Connect to Kura's PostgreSQL database (read-only user)
- Query pgvector extension for semantic search
- Use Kura's embedding model (same as notes are indexed with)
- Respect user permissions (filter by user_id from OAuth token)

### 4. Technology Stack

#### Core Framework
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x (strict mode)
- **Web Framework:** Fastify 4.x
  - Fast, low-overhead
  - Built-in JSON schema validation
  - Excellent TypeScript support
  - Plugin ecosystem for MCP, OAuth, etc.

#### Database & ORM
- **ORM:** Prisma 5.x
- **Database:** PostgreSQL 15+ (shared with Kura)
- **Connection:** Read-only connection to Kura's database
- **Vector Extension:** pgvector (for semantic search)

#### Authentication
- **OAuth Client:** Node.js OAuth2 client library
- **JWT Validation:** `jsonwebtoken` + `jwks-rsa`
- **Integration:** KOauth OAuth2 server

#### MCP Implementation
- **SDK:** `@modelcontextprotocol/sdk` (official TypeScript SDK)
- **Transport:** HTTP + SSE via Fastify
- **Protocol:** JSON-RPC 2.0

#### Deployment
- **Containerization:** Docker + Docker Compose
- **Process Manager:** PM2 (in container)
- **Reverse Proxy:** Nginx (SSL termination)
- **Environment:** VPS (alongside KOauth and Kura)

---

## MVP Scope (Phase 1)

### In Scope
✅ Single MCP tool: `search_kura_notes`
✅ OAuth 2.1 token validation via KOauth
✅ Dynamic Client Registration (RFC 7591)
✅ Protected Resource Metadata (RFC 9728)
✅ Basic error handling and logging
✅ Docker deployment
✅ Health check endpoint
✅ Rate limiting (per client)
✅ Integration tests

### Out of Scope (Future Phases)
❌ Additional MCP tools (create note, update note, delete note)
❌ Real-time note updates via SSE
❌ Advanced caching layer
❌ Multi-tenancy support
❌ Analytics dashboard
❌ Webhook support
❌ MCP Resources (note content as resources)
❌ MCP Prompts (templated queries)

---

## Non-Functional Requirements

### Performance
- Response time: < 500ms (p95) for search queries
- Concurrent requests: Support 100+ concurrent users
- Database connection pooling

### Security
- HTTPS only (TLS 1.3)
- OAuth2 token validation on every request
- SQL injection prevention (Prisma parameterized queries)
- Rate limiting: 100 requests/minute per client
- Security headers (HSTS, CSP, etc.)
- No sensitive data in logs

### Reliability
- 99.5% uptime target
- Graceful degradation if Kura DB unavailable
- Health checks for monitoring
- Structured logging (JSON format)
- Error tracking

### Maintainability
- Comprehensive TypeScript types
- Unit test coverage > 80%
- Integration tests for MCP flow
- API documentation
- Deployment automation

---

## API Endpoints

### Health & Metadata
- `GET /health` - Health check (no auth required)
- `GET /.well-known/oauth-protected-resource` - OAuth resource metadata (no auth required)

### MCP Protocol (JSON-RPC 2.0)
- `POST /mcp` - Main MCP endpoint (all JSON-RPC methods)
  - Requires: `Authorization: Bearer <token>` header
  - Methods:
    - `tools/list` - List available tools
    - `tools/call` - Execute a tool

### Development/Debug (removed in production)
- `GET /debug/capabilities` - Show MCP server capabilities

---

## Data Model

### OAuth Token Claims (from KOauth)
```typescript
interface TokenClaims {
  sub: string;        // user_id
  client_id: string;  // OAuth client identifier
  scope: string[];    // granted scopes
  exp: number;        // expiration timestamp
  iat: number;        // issued at timestamp
  iss: string;        // issuer (KOauth URL)
  aud: string;        // audience (KOmcp URL)
}
```

### Kura Notes Schema (read-only)
```typescript
interface KuraNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  embedding: number[];  // pgvector
  created_at: Date;
  updated_at: Date;
}
```

---

## Configuration

### Environment Variables
```bash
# Server
NODE_ENV=production
PORT=3003
HOST=0.0.0.0

# KOauth Integration
KOAUTH_URL=https://auth.example.com
KOAUTH_JWKS_URL=https://auth.example.com/.well-known/jwks.json
KOAUTH_CLIENT_REGISTRATION_URL=https://auth.example.com/oauth/register

# Kura Database (Read-Only)
KURA_DATABASE_URL=postgresql://komcp_readonly:password@kura-db:5432/kura

# Security
ALLOWED_ORIGINS=https://claude.ai
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
```

---

## Success Criteria

### MVP Success Metrics
1. ✅ Claude web can discover and register with KOmcp
2. ✅ OAuth flow completes successfully
3. ✅ `search_kura_notes` tool returns accurate results
4. ✅ < 500ms response time for searches (p95)
5. ✅ Zero authentication bypasses (security audit)
6. ✅ Successfully deployed on VPS with Docker
7. ✅ Integration tests pass for full MCP flow

### User Acceptance Criteria
- User can add KOmcp as custom connector in Claude web
- User authorizes via KOauth OAuth flow
- User asks Claude "search my notes for X"
- Claude calls `search_kura_notes` tool successfully
- Results are accurate and relevant
- No errors or authentication issues

---

## Dependencies

### External Services
- **KOauth:** OAuth2 server (must support RFC 7591 Dynamic Client Registration)
- **Kura:** PostgreSQL database with pgvector extension
- **Embedding Service:** Same model Kura uses for indexing

### Infrastructure
- VPS with Docker support
- PostgreSQL 15+ with pgvector
- Nginx reverse proxy
- SSL certificates

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| KOauth doesn't support RFC 7591 | High | Implement Dynamic Client Registration in KOauth first |
| Kura DB performance issues | Medium | Read-only replica, connection pooling, query optimization |
| Claude API changes | Medium | Monitor MCP spec updates, version pinning |
| Token validation overhead | Low | Cache JWKS keys, optimize validation logic |
| Rate limiting too strict | Low | Make configurable, monitor usage patterns |

---

## Timeline Estimate

**Phase 1 (MVP):**
- Setup & Architecture: 1-2 days
- Core MCP implementation: 2-3 days
- OAuth integration: 2-3 days
- Kura search integration: 1-2 days
- Testing & deployment: 2-3 days
- **Total: ~10 days**

---

## Future Enhancements (Post-MVP)

### Phase 2: Write Operations
- `create_note` tool
- `update_note` tool
- `delete_note` tool

### Phase 3: Advanced Features
- Real-time updates via SSE
- MCP Resources (expose notes as resources)
- MCP Prompts (templated search queries)
- Caching layer (Redis)

### Phase 4: Operations
- Monitoring dashboard
- Usage analytics
- Performance optimization
- Multi-region deployment

---

## References

### MCP Protocol
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### Claude Integration
- [Building Custom Connectors via Remote MCP Servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [MCP Connector - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector)

### OAuth & Security
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [OAuth 2.1 Authorization Framework](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)

---

## Approval

- [ ] Product Owner: Till Matthis
- [ ] Technical Lead: Till Matthis
- [ ] Security Review: Pending
- [ ] Architecture Review: Pending

---

**Document History:**
- 2025-12-01: Initial draft (v1.0)
