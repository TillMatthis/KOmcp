# KOmcp Build Checklist

**Version:** 1.0
**Date:** 2025-12-01
**Project:** KOmcp - Remote MCP Server

This checklist tracks the implementation of KOmcp, broken into phases for incremental delivery.

---

## Phase 0: Project Setup & Foundation

### Repository & Tooling
- [ ] Initialize Git repository (already done)
- [ ] Set up TypeScript configuration (`tsconfig.json`)
- [ ] Configure ESLint + Prettier
- [ ] Set up package.json with dependencies
- [ ] Create .gitignore
- [ ] Create .env.example
- [ ] Set up GitHub Actions for CI/CD
- [ ] Configure Dependabot for dependency updates

### Dependencies Installation
```bash
# Core
npm install fastify @fastify/cors @fastify/rate-limit @fastify/helmet
npm install @modelcontextprotocol/sdk
npm install @prisma/client prisma

# OAuth & Auth
npm install jsonwebtoken jwks-rsa
npm install @types/jsonwebtoken

# Utilities
npm install zod pino pino-pretty dotenv

# Dev dependencies
npm install -D typescript @types/node
npm install -D eslint prettier
npm install -D jest @types/jest ts-jest
npm install -D tsx nodemon
```

### Project Structure
- [ ] Create `src/` directory structure
  - [ ] `src/server.ts` - Main entry point
  - [ ] `src/config/` - Configuration files
  - [ ] `src/middleware/` - Middleware functions
  - [ ] `src/routes/` - Route handlers
  - [ ] `src/mcp/` - MCP server implementation
  - [ ] `src/services/` - Business logic services
  - [ ] `src/types/` - TypeScript type definitions
- [ ] Create `prisma/` directory with schema
- [ ] Create `tests/` directory structure
- [ ] Create `docker/` directory
- [ ] Create `.env.example` with all required variables

**Commit Message:** `chore: initialize project structure and dependencies`

---

## Phase 1: Core Infrastructure

### 1.1 Environment Configuration
- [ ] Create `src/config/env.ts` with Zod validation
- [ ] Document all environment variables in `.env.example`
- [ ] Test environment variable loading
- [ ] Add validation for required vs optional variables

**Files:**
- `src/config/env.ts`
- `.env.example`

**Commit Message:** `feat: add environment configuration with validation`

### 1.2 Logging Setup
- [ ] Configure Pino logger in `src/config/logger.ts`
- [ ] Set up log levels (development vs production)
- [ ] Add request/response logging
- [ ] Sanitize sensitive data (tokens, passwords) from logs
- [ ] Test log output format

**Files:**
- `src/config/logger.ts`

**Commit Message:** `feat: configure structured logging with Pino`

### 1.3 Fastify Server Bootstrap
- [ ] Create basic Fastify server in `src/server.ts`
- [ ] Configure server options (logger, bodyLimit, etc.)
- [ ] Add CORS plugin with configuration
- [ ] Add Helmet plugin for security headers
- [ ] Add Rate Limit plugin
- [ ] Create graceful shutdown handler
- [ ] Test server starts and stops cleanly

**Files:**
- `src/server.ts`
- `src/index.ts` (entry point)

**Commit Message:** `feat: bootstrap Fastify server with security plugins`

**Test:** `npm run dev` - Server starts on port 3003

---

## Phase 2: OAuth2 Integration with KOauth

### 2.1 Protected Resource Metadata Endpoint
- [ ] Create `src/routes/well-known.ts`
- [ ] Implement `GET /.well-known/oauth-protected-resource` (RFC 9728)
- [ ] Return OAuth metadata:
  - Authorization server URL (KOauth)
  - Scopes required
  - Token endpoint
  - Registration endpoint
- [ ] Test endpoint returns correct JSON structure

**Files:**
- `src/routes/well-known.ts`
- `src/types/oauth.ts`

**Commit Message:** `feat: add OAuth Protected Resource Metadata endpoint`

**Test:** `curl http://localhost:3003/.well-known/oauth-protected-resource`

### 2.2 OAuth Token Verification Service
- [ ] Create `src/services/oauth.ts`
- [ ] Implement JWKS client for fetching public keys
- [ ] Implement `verifyToken()` function:
  - Verify JWT signature
  - Check expiration
  - Validate issuer (KOauth URL)
  - Validate audience (KOmcp URL)
  - Extract claims (sub, client_id, scope)
- [ ] Add JWKS key caching (1 hour TTL)
- [ ] Add error handling for invalid tokens
- [ ] Write unit tests for token verification

**Files:**
- `src/services/oauth.ts`
- `src/types/auth.ts`
- `tests/unit/oauth.test.ts`

**Commit Message:** `feat: implement OAuth2 token verification with JWKS`

**Test:** Unit tests pass with valid/invalid tokens

### 2.3 Authentication Middleware
- [ ] Create `src/middleware/auth.ts`
- [ ] Extract Bearer token from Authorization header
- [ ] Call `verifyToken()` service
- [ ] Attach user claims to request object
- [ ] Return 401 with WWW-Authenticate header if no/invalid token
- [ ] Verify required scopes (`mcp:tools:read`, `mcp:tools:execute`)
- [ ] Write unit tests for middleware

**Files:**
- `src/middleware/auth.ts`
- `tests/unit/auth-middleware.test.ts`

**Commit Message:** `feat: add OAuth2 authentication middleware`

**Test:** Request with valid token passes, invalid/missing token returns 401

### 2.4 Integration Test with KOauth
- [ ] Set up test KOauth instance (or use staging)
- [ ] Register test OAuth client
- [ ] Obtain test access token
- [ ] Verify token validation works end-to-end
- [ ] Test token expiration handling
- [ ] Test insufficient scopes rejection

**Files:**
- `tests/integration/oauth-flow.test.ts`

**Commit Message:** `test: add OAuth integration tests with KOauth`

**Verification:** Integration tests pass with real KOauth server

---

## Phase 3: Database & Kura Integration

### 3.1 Prisma Setup
- [ ] Create `prisma/schema.prisma`
- [ ] Define Note model (matching Kura schema)
- [ ] Configure PostgreSQL datasource
- [ ] Add pgvector support (`Unsupported("vector(1536)")`)
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Test connection to Kura database (read-only)

**Files:**
- `prisma/schema.prisma`

**Commit Message:** `feat: configure Prisma with Kura database schema`

**Test:** `npx prisma db pull` - Validates connection

### 3.2 Kura Search Service
- [ ] Create `src/services/kura.ts`
- [ ] Implement `KuraSearchService` class
- [ ] Add Prisma client initialization
- [ ] Implement `searchNotes()` method:
  - Accept userId, query, limit, minSimilarity
  - Generate query embedding
  - Execute pgvector similarity search
  - Filter by user_id
  - Return results with similarity scores
- [ ] Add error handling (DB connection, query errors)
- [ ] Add performance logging (query time)
- [ ] Write unit tests (mock Prisma)

**Files:**
- `src/services/kura.ts`
- `tests/unit/kura.test.ts`

**Commit Message:** `feat: implement Kura notes semantic search service`

**Test:** Unit tests pass with mocked database

### 3.3 Embedding Service
- [ ] Create `src/services/embeddings.ts`
- [ ] Determine Kura's embedding model (check with Kura codebase)
- [ ] Implement `generateEmbedding(text: string): Promise<number[]>`
- [ ] Options:
  - Use same API endpoint as Kura
  - Use same model (e.g., OpenAI, local model)
- [ ] Add caching if needed
- [ ] Add error handling
- [ ] Write unit tests

**Files:**
- `src/services/embeddings.ts`
- `tests/unit/embeddings.test.ts`

**Commit Message:** `feat: add embedding generation service`

**Test:** Generate embedding for "test query"

### 3.4 Integration Test with Kura Database
- [ ] Create test notes in Kura DB (or use existing)
- [ ] Test search returns correct results
- [ ] Verify user_id filtering works
- [ ] Test similarity threshold filtering
- [ ] Test limit parameter
- [ ] Measure query performance

**Files:**
- `tests/integration/kura-search.test.ts`

**Commit Message:** `test: add Kura database integration tests`

**Verification:** Semantic search returns relevant notes

---

## Phase 4: MCP Protocol Implementation

### 4.1 MCP Server Setup
- [ ] Create `src/mcp/server.ts`
- [ ] Initialize MCP Server from `@modelcontextprotocol/sdk`
- [ ] Configure server capabilities:
  - `tools: { listChanged: true }`
  - `logging: {}`
- [ ] Set server name and version
- [ ] Export MCPServer class

**Files:**
- `src/mcp/server.ts`
- `src/types/mcp.ts`

**Commit Message:** `feat: initialize MCP server with capabilities`

### 4.2 Tools List Handler
- [ ] Implement `tools/list` request handler
- [ ] Define `search_kura_notes` tool schema:
  - Name, description
  - Input schema (query, limit, min_similarity)
  - Output schema (results array)
- [ ] Return tool list in MCP format
- [ ] Write unit tests

**Files:**
- `src/mcp/tools/search-notes.ts`
- `src/mcp/schemas.ts`
- `tests/unit/mcp-tools.test.ts`

**Commit Message:** `feat: implement MCP tools/list handler`

**Test:** `tools/list` returns search_kura_notes tool

### 4.3 Tool Call Handler
- [ ] Implement `tools/call` request handler
- [ ] Validate tool name (`search_kura_notes`)
- [ ] Extract and validate input arguments
- [ ] Extract user_id from authentication context
- [ ] Call `KuraSearchService.searchNotes()`
- [ ] Format results in MCP response format
- [ ] Handle errors (tool not found, validation errors)
- [ ] Write unit tests

**Files:**
- `src/mcp/tools/search-notes.ts`
- `tests/unit/mcp-tool-call.test.ts`

**Commit Message:** `feat: implement MCP tools/call handler for search_kura_notes`

**Test:** Tool execution returns search results

### 4.4 MCP Route Integration
- [ ] Create `src/routes/mcp.ts`
- [ ] Implement `POST /mcp` endpoint
- [ ] Apply authentication middleware
- [ ] Parse JSON-RPC 2.0 requests
- [ ] Route to MCP server handlers
- [ ] Return JSON-RPC 2.0 responses
- [ ] Handle batch requests (optional)
- [ ] Add request/response logging
- [ ] Write integration tests

**Files:**
- `src/routes/mcp.ts`
- `tests/integration/mcp-endpoint.test.ts`

**Commit Message:** `feat: add MCP JSON-RPC endpoint with auth`

**Test:** Send JSON-RPC request, receive valid response

---

## Phase 5: Error Handling & Validation

### 5.1 Error Types
- [ ] Create `src/types/errors.ts`
- [ ] Define error classes:
  - `MCPError` (base class)
  - `UnauthorizedError` (401)
  - `InvalidToolError` (-32601)
  - `InvalidParamsError` (-32602)
  - `InternalError` (-32603)
- [ ] Add error codes per JSON-RPC 2.0 spec

**Files:**
- `src/types/errors.ts`

**Commit Message:** `feat: define MCP error types`

### 5.2 Error Handler Middleware
- [ ] Create `src/middleware/error.ts`
- [ ] Implement global error handler
- [ ] Transform errors to JSON-RPC format
- [ ] Log errors with context
- [ ] Don't expose sensitive info in error messages
- [ ] Return appropriate HTTP status codes
- [ ] Write tests

**Files:**
- `src/middleware/error.ts`
- `tests/unit/error-handler.test.ts`

**Commit Message:** `feat: implement error handler middleware`

### 5.3 Input Validation
- [ ] Add JSON schema validation for MCP requests
- [ ] Validate tool arguments against schemas
- [ ] Validate query length, limit range, similarity range
- [ ] Add sanitization where needed
- [ ] Return descriptive validation errors
- [ ] Write tests for edge cases

**Files:**
- `src/middleware/validation.ts`
- `tests/unit/validation.test.ts`

**Commit Message:** `feat: add input validation for MCP requests`

---

## Phase 6: Health Checks & Monitoring

### 6.1 Health Check Endpoint
- [ ] Create `src/routes/health.ts`
- [ ] Implement `GET /health` endpoint (no auth)
- [ ] Check database connectivity
- [ ] Check KOauth reachability (optional)
- [ ] Return JSON with health status
- [ ] Include uptime, version, timestamp
- [ ] Return 503 if unhealthy

**Files:**
- `src/routes/health.ts`
- `tests/integration/health.test.ts`

**Commit Message:** `feat: add health check endpoint`

**Test:** `curl http://localhost:3003/health`

### 6.2 Metrics & Logging
- [ ] Add request/response time logging
- [ ] Log tool execution metrics (query time, results count)
- [ ] Add structured log fields (userId, clientId, toolName)
- [ ] Log errors with stack traces
- [ ] Configure log rotation (if needed)

**Files:**
- `src/middleware/metrics.ts`

**Commit Message:** `feat: add metrics and structured logging`

---

## Phase 7: Docker & Deployment

### 7.1 Dockerfile
- [ ] Create `docker/Dockerfile`
- [ ] Use Node 20 Alpine base image
- [ ] Multi-stage build (build + runtime)
- [ ] Copy only necessary files
- [ ] Run as non-root user
- [ ] Set up health check in Dockerfile
- [ ] Test Docker build locally

**Files:**
- `docker/Dockerfile`

**Commit Message:** `feat: add Dockerfile for production deployment`

**Test:** `docker build -t komcp .`

### 7.2 Docker Compose
- [ ] Create `docker/docker-compose.yml`
- [ ] Define komcp service
- [ ] Configure environment variables
- [ ] Set up networking
- [ ] Add health checks
- [ ] Configure restart policy
- [ ] Test local deployment

**Files:**
- `docker/docker-compose.yml`
- `docker/.env.example`

**Commit Message:** `feat: add Docker Compose configuration`

**Test:** `docker-compose up` - Service starts successfully

### 7.3 Nginx Configuration
- [ ] Create `nginx/nginx.conf`
- [ ] Configure upstream (komcp:3003)
- [ ] Set up SSL/TLS (port 443)
- [ ] Add security headers
- [ ] Configure proxy settings
- [ ] Set up HTTP/2
- [ ] Add rate limiting (nginx level)
- [ ] Test reverse proxy locally

**Files:**
- `nginx/nginx.conf`
- `nginx/Dockerfile` (optional)

**Commit Message:** `feat: add Nginx reverse proxy configuration`

### 7.4 VPS Deployment Script
- [ ] Create `scripts/deploy.sh`
- [ ] SSH to VPS
- [ ] Pull latest code
- [ ] Build Docker images
- [ ] Run database migrations (if any)
- [ ] Start services
- [ ] Verify health check
- [ ] Set up log rotation

**Files:**
- `scripts/deploy.sh`
- `scripts/rollback.sh`

**Commit Message:** `feat: add deployment scripts for VPS`

### 7.5 CI/CD Pipeline
- [ ] Create `.github/workflows/ci.yml`
- [ ] Run linting on push
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Build Docker image
- [ ] Push to registry (optional)
- [ ] Auto-deploy on merge to main (optional)

**Files:**
- `.github/workflows/ci.yml`

**Commit Message:** `feat: add GitHub Actions CI/CD pipeline`

---

## Phase 8: Testing & Validation

### 8.1 Unit Tests
- [ ] OAuth token verification tests
- [ ] Kura search service tests (mocked)
- [ ] MCP tool handler tests
- [ ] Middleware tests
- [ ] Error handling tests
- [ ] Target: >80% code coverage

**Verification:** `npm test` - All unit tests pass

### 8.2 Integration Tests
- [ ] Full MCP flow test:
  1. Request without token → 401
  2. Get OAuth metadata → 200
  3. Request with valid token → Tool list
  4. Execute search tool → Results
- [ ] Database integration tests
- [ ] OAuth integration tests with KOauth

**Verification:** `npm run test:integration` - All integration tests pass

### 8.3 End-to-End Test with Claude
- [ ] Deploy to staging environment
- [ ] Add KOmcp as custom connector in Claude web:
  - Enter MCP server URL
  - (If needed) Enter OAuth Client ID/Secret
- [ ] Complete OAuth authorization flow
- [ ] Test tool discovery in Claude
- [ ] Test search query: "Find notes about X"
- [ ] Verify results are returned correctly
- [ ] Test error handling (invalid queries, etc.)

**Verification:** Claude successfully searches Kura notes via KOmcp

### 8.4 Load Testing
- [ ] Set up load testing (k6 or artillery)
- [ ] Test 100+ concurrent requests
- [ ] Measure response times (p50, p95, p99)
- [ ] Test rate limiting behavior
- [ ] Monitor memory/CPU usage
- [ ] Verify no memory leaks

**Files:**
- `tests/load/search.test.js`

**Verification:** Handles 100+ concurrent users, <500ms p95 response time

---

## Phase 9: Documentation & Cleanup

### 9.1 API Documentation
- [ ] Document all endpoints (OpenAPI/Swagger)
- [ ] Document OAuth flow
- [ ] Document MCP tool schemas
- [ ] Add example requests/responses
- [ ] Document error codes

**Files:**
- `docs/api.md`
- `openapi.yaml`

**Commit Message:** `docs: add API documentation`

### 9.2 README
- [ ] Update README.md with:
  - Project description
  - Prerequisites
  - Installation instructions
  - Configuration guide
  - Usage examples
  - Deployment instructions
  - Troubleshooting guide
- [ ] Add badges (CI status, coverage, etc.)

**Files:**
- `README.md`

**Commit Message:** `docs: update README with complete setup guide`

### 9.3 Code Review & Cleanup
- [ ] Review all code for consistency
- [ ] Check TypeScript types (no `any` types)
- [ ] Remove commented-out code
- [ ] Remove debug logs
- [ ] Verify all TODOs are resolved
- [ ] Run linter and fix issues
- [ ] Format code with Prettier

**Commit Message:** `refactor: code cleanup and formatting`

### 9.4 Security Audit
- [ ] Review all authentication/authorization code
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify no secrets in code/logs
- [ ] Review rate limiting configuration
- [ ] Check CORS configuration
- [ ] Review error messages (no info leakage)
- [ ] Run security audit: `npm audit`
- [ ] Fix any high/critical vulnerabilities

**Commit Message:** `security: address security audit findings`

---

## Phase 10: Production Deployment

### 10.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Secrets configured in production environment
- [ ] Database read-only user created in Kura
- [ ] KOauth updated to support Dynamic Client Registration (if needed)
- [ ] Monitoring/alerting set up
- [ ] Backup plan documented
- [ ] Rollback procedure tested

### 10.2 Production Deployment
- [ ] Deploy to production VPS
- [ ] Configure DNS (mcp.example.com)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Start services via Docker Compose
- [ ] Verify health check responds
- [ ] Test OAuth flow with production KOauth
- [ ] Monitor logs for errors

**Verification:** Production service is accessible and healthy

### 10.3 Claude Integration
- [ ] Add KOmcp as custom connector in Claude web (production)
- [ ] Complete OAuth authorization
- [ ] Test search functionality
- [ ] Verify results accuracy
- [ ] Monitor for errors

**Success Criteria:** Claude successfully searches Kura notes in production

### 10.4 Post-Deployment Monitoring
- [ ] Monitor logs for errors (first 24 hours)
- [ ] Check performance metrics
- [ ] Verify no authentication issues
- [ ] Monitor resource usage (CPU, memory, disk)
- [ ] Check database query performance
- [ ] Verify rate limiting working correctly

---

## Maintenance Tasks (Ongoing)

### Regular
- [ ] Monitor error logs daily
- [ ] Review performance metrics weekly
- [ ] Check for dependency updates monthly
- [ ] Rotate logs (if not automated)
- [ ] Review and rotate secrets quarterly

### As Needed
- [ ] Update dependencies (security patches)
- [ ] Scale resources if needed
- [ ] Add new MCP tools (Phase 2+)
- [ ] Optimize slow queries
- [ ] Implement caching (if needed)

---

## Success Metrics

### MVP Launch Criteria
- ✅ All Phase 1-10 tasks completed
- ✅ All tests passing (unit + integration)
- ✅ Claude can successfully search Kura notes
- ✅ <500ms response time (p95)
- ✅ Zero authentication bypasses
- ✅ Production deployment successful
- ✅ Documentation complete

### Key Performance Indicators (KPIs)
- **Uptime:** >99.5%
- **Response Time:** <500ms (p95)
- **Error Rate:** <1%
- **Test Coverage:** >80%
- **Successful Searches:** >95% (non-error rate)

---

## Notes

### Dependencies Between Phases
- Phase 2 (OAuth) must be completed before Phase 4 (MCP)
- Phase 3 (Database) must be completed before Phase 4.3 (Tool Call Handler)
- Phase 7 (Docker) can be done in parallel with earlier phases

### Iteration Approach
- Complete each phase fully before moving to next
- Write tests alongside feature implementation (not at the end)
- Commit frequently with descriptive messages
- Update this checklist as you progress

### Risk Areas
1. **KOauth compatibility:** Ensure KOauth supports RFC 7591 (Dynamic Client Registration)
2. **Embedding consistency:** Must use same embedding model as Kura
3. **Database performance:** pgvector queries must be optimized
4. **Claude API changes:** Monitor MCP spec updates

---

**Last Updated:** 2025-12-01
**Current Phase:** Phase 0 (Setup)
