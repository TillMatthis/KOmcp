# Claude Code Development Rules for KOmcp

**Version:** 1.0
**Date:** 2025-12-01
**Project:** KOmcp - Remote MCP Server

---

## Purpose

This document establishes development rules and practices for working on KOmcp with Claude Code. These rules ensure consistency, quality, and maintainability throughout the development process.

---

## Core Principles

### 1. **One Task at a Time**
- Focus on completing ONE task from BUILD-CHECKLIST.md before moving to the next
- Check off tasks immediately after completion
- Never skip ahead or work on multiple unrelated tasks simultaneously
- If a task reveals subtasks, break it down in the checklist

### 2. **Documentation First**
- Always consult documentation before implementing:
  1. `komcp-prd.md` - Requirements and scope
  2. `architecture.md` - Technical design decisions
  3. `BUILD-CHECKLIST.md` - Implementation order
- Update documentation when requirements or architecture changes
- Document decisions and trade-offs in code comments or architecture.md

### 3. **Incremental Development**
- Build features incrementally with frequent commits
- Each commit should represent a complete, working change
- Test after each significant change before proceeding
- Never commit broken or incomplete code

### 4. **Test-Driven Mindset**
- Write tests alongside feature implementation (not at the end)
- Every feature should have:
  - Unit tests (isolated logic)
  - Integration tests (component interaction)
- Run tests before committing: `npm test`
- Maintain >80% code coverage

---

## Git Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

<optional detailed description>

<optional footer>
```

### Commit Types

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring (no behavior change)
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks (dependencies, config)
- `style:` - Code formatting (no logic change)
- `perf:` - Performance improvements
- `security:` - Security-related changes

### Examples

```bash
# Good commit messages
feat(mcp): implement tools/list handler
fix(auth): correct token expiration validation
test(kura): add integration tests for search service
docs(readme): update installation instructions
chore(deps): update @modelcontextprotocol/sdk to v1.0.5

# Bad commit messages (avoid these)
- "fixed stuff"
- "WIP"
- "updates"
- "test"
```

### Commit Frequency

- Commit after completing each BUILD-CHECKLIST task
- Commit after writing a complete, tested feature
- Commit before switching to a different area of code
- DO NOT commit broken code or failing tests

---

## Code Quality Standards

### TypeScript

#### Strict Mode
- Always use strict TypeScript configuration
- Never use `any` type (use `unknown` if necessary)
- Define explicit types for all function parameters and return values
- Use interfaces for object shapes, types for unions/intersections

#### Example
```typescript
// ✅ Good
interface SearchParams {
  query: string;
  limit?: number;
  minSimilarity?: number;
}

async function searchNotes(
  userId: string,
  params: SearchParams
): Promise<SearchResult> {
  // ...
}

// ❌ Bad
async function searchNotes(userId: any, params: any): any {
  // ...
}
```

### Error Handling

- Always handle errors explicitly
- Use custom error classes (defined in `src/types/errors.ts`)
- Never swallow errors silently
- Log errors with context before throwing/returning

#### Example
```typescript
// ✅ Good
try {
  const results = await searchNotes(userId, params);
  return results;
} catch (error) {
  logger.error({ error, userId, params }, 'Search failed');
  throw new InternalError('Failed to search notes');
}

// ❌ Bad
try {
  const results = await searchNotes(userId, params);
  return results;
} catch (error) {
  // Silently ignored - BAD!
}
```

### Security

#### Never Log Sensitive Data
```typescript
// ✅ Good
logger.info({
  userId: request.user.userId,
  toolName: 'search_kura_notes'
}, 'Tool executed');

// ❌ Bad
logger.info({
  userId: request.user.userId,
  token: request.headers.authorization, // NEVER LOG TOKENS!
  query: params.query // OK, but be careful with PII
}, 'Tool executed');
```

#### Always Validate Input
```typescript
// ✅ Good
const schema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.7)
});

const params = schema.parse(input);

// ❌ Bad
const params = input; // No validation!
```

#### Always Use Parameterized Queries
```typescript
// ✅ Good (Prisma handles this)
const results = await prisma.note.findMany({
  where: { user_id: userId }
});

// ❌ Bad (vulnerable to SQL injection)
const results = await prisma.$queryRaw`
  SELECT * FROM notes WHERE user_id = '${userId}'
`;
```

---

## Development Workflow

### Starting a New Task

1. Check BUILD-CHECKLIST.md for next task
2. Understand the task fully (read PRD/architecture if needed)
3. Create a new branch (optional for large features):
   ```bash
   git checkout -b feat/task-name
   ```
4. Implement the task incrementally
5. Write tests as you go
6. Update checklist when complete
7. Commit with descriptive message
8. Push to remote

### Before Committing

Run this checklist:
- [ ] Code compiles without errors: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linter passes: `npm run lint`
- [ ] No sensitive data in code or logs
- [ ] BUILD-CHECKLIST.md updated (task checked off)
- [ ] Code formatted: `npm run format`

### After Committing

```bash
# 1. Verify commit
git log -1 --stat

# 2. Push to remote
git push -u origin claude/komcp-mcp-server-01UPw1BPidQ2tS7gQKj7S9o2

# 3. Verify push succeeded
git status
```

---

## File Organization Rules

### Directory Structure Consistency

Always place files in the correct directory:

```
src/
├── server.ts              # Main entry point only
├── config/                # Configuration (env, logger)
├── middleware/            # Fastify middleware (auth, error, metrics)
├── routes/                # HTTP route handlers
├── mcp/                   # MCP-specific logic (server, tools)
│   └── tools/            # Individual tool implementations
├── services/              # Business logic (oauth, kura, embeddings)
└── types/                 # TypeScript type definitions
```

### Naming Conventions

- **Files:** kebab-case (`search-notes.ts`, `oauth-metadata.ts`)
- **Classes:** PascalCase (`MCPServer`, `KuraSearchService`)
- **Functions:** camelCase (`verifyToken`, `searchNotes`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_QUERY_LENGTH`, `DEFAULT_LIMIT`)
- **Interfaces/Types:** PascalCase (`SearchParams`, `TokenClaims`)

### Imports Organization

Order imports as follows:
1. Node.js built-ins
2. External packages
3. Internal modules (by folder: config, middleware, services, types)
4. Relative imports

```typescript
// ✅ Good
import { readFile } from 'fs/promises';

import Fastify from 'fastify';
import { z } from 'zod';

import { config } from './config/env';
import { authMiddleware } from './middleware/auth';
import { verifyToken } from './services/oauth';
import { TokenClaims } from './types/auth';

import { searchNotes } from './search';
```

---

## Testing Requirements

### Unit Tests

- Test individual functions/methods in isolation
- Mock external dependencies (database, HTTP calls)
- Use descriptive test names
- Cover edge cases and error conditions

```typescript
// ✅ Good test structure
describe('OAuth Token Verification', () => {
  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      // Arrange
      const token = generateTestToken();

      // Act
      const claims = await verifyToken(token);

      // Assert
      expect(claims.sub).toBe('user-123');
      expect(claims.scope).toContain('mcp:tools:read');
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = generateExpiredToken();

      // Act & Assert
      await expect(verifyToken(expiredToken)).rejects.toThrow('Token expired');
    });
  });
});
```

### Integration Tests

- Test multiple components working together
- Use real dependencies where possible (test database, etc.)
- Test complete workflows (OAuth flow, MCP request/response)
- Clean up test data after each test

### Test Coverage

- Minimum 80% code coverage
- Focus on critical paths (authentication, search logic, error handling)
- Use coverage reports to find untested code:
  ```bash
  npm test -- --coverage
  ```

---

## Documentation Requirements

### Code Comments

- Add comments for complex logic or non-obvious decisions
- Explain WHY, not WHAT (code should be self-documenting)
- Use JSDoc for public functions

```typescript
/**
 * Search Kura notes using semantic similarity.
 *
 * @param userId - User ID to filter notes by
 * @param query - Natural language search query
 * @param limit - Maximum number of results (1-50)
 * @param minSimilarity - Minimum cosine similarity threshold (0-1)
 * @returns Search results with similarity scores
 * @throws {DatabaseError} If database query fails
 */
export async function searchNotes(
  userId: string,
  query: string,
  limit = 10,
  minSimilarity = 0.7
): Promise<SearchResult> {
  // Generate embedding for query (must use same model as Kura indexing)
  const embedding = await generateEmbedding(query);

  // Use pgvector <=> operator for cosine distance
  // Note: 1 - distance = similarity score
  const results = await prisma.$queryRaw`...`;

  return results;
}
```

### Update Documentation

When making architectural changes, update:
1. `architecture.md` - Architecture decisions, tech stack changes
2. `komcp-prd.md` - Scope changes, new requirements
3. `BUILD-CHECKLIST.md` - Task breakdown changes
4. `README.md` - User-facing changes (installation, configuration, usage)

---

## Environment & Configuration

### Environment Variables

- Never hardcode configuration values
- Always use environment variables via `src/config/env.ts`
- Document all variables in `.env.example`
- Use Zod validation for all environment variables

```typescript
// ✅ Good
const koauthUrl = config.KOAUTH_URL;

// ❌ Bad
const koauthUrl = 'https://auth.example.com'; // Hardcoded!
```

### Secrets Management

- NEVER commit secrets to git
- Use `.env` for local development (git-ignored)
- Use environment variables or secrets managers in production
- Rotate secrets regularly

---

## Dependencies Management

### Adding Dependencies

Before adding a new dependency, ask:
1. Is it necessary? Can we implement it ourselves?
2. Is it actively maintained?
3. Does it have good TypeScript support?
4. Is it well-documented?
5. Does it have security vulnerabilities? (check `npm audit`)

### Updating Dependencies

- Review changelogs before updating
- Test thoroughly after updates
- Update one major dependency at a time
- Run `npm audit` after updates

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## Debugging & Troubleshooting

### Logging Best Practices

- Use structured logging (JSON format)
- Include context in logs (userId, requestId, etc.)
- Use appropriate log levels:
  - `fatal`: Application crash
  - `error`: Errors requiring attention
  - `warn`: Warnings (deprecated features, high latency)
  - `info`: Important events (tool execution, auth success)
  - `debug`: Detailed debugging info
  - `trace`: Very detailed debugging (usually disabled)

```typescript
// ✅ Good logging
logger.info({
  userId: claims.sub,
  clientId: claims.client_id,
  toolName: 'search_kura_notes',
  resultCount: results.length,
  queryTimeMs: queryTime
}, 'Tool executed successfully');

// ❌ Bad logging
console.log('Search done'); // No context, not structured
```

### Debugging Steps

1. Check logs: `docker-compose logs -f komcp`
2. Verify environment variables: `printenv | grep KOAUTH`
3. Test database connection: `npx prisma db pull`
4. Test OAuth token: Use curl or Postman
5. Check health endpoint: `curl http://localhost:3003/health`

---

## Performance Considerations

### Database Queries

- Use connection pooling (Prisma handles this)
- Create indexes for frequently queried columns
- Measure query performance:
  ```typescript
  const startTime = Date.now();
  const results = await prisma.note.findMany(...);
  const queryTime = Date.now() - startTime;
  logger.debug({ queryTimeMs: queryTime }, 'Query executed');
  ```

### Caching

- Cache JWKS keys (1 hour TTL)
- Consider caching frequent searches (future optimization)
- Don't over-cache - start simple, optimize based on metrics

### Resource Limits

- Set request body size limits (Fastify config)
- Set connection pool limits (Prisma config)
- Set rate limits per client
- Monitor memory usage

---

## Security Checklist

Before each commit, verify:
- [ ] No secrets in code
- [ ] No tokens in logs
- [ ] All inputs validated
- [ ] All queries parameterized (Prisma)
- [ ] Authentication required on all protected endpoints
- [ ] Scopes validated for each tool
- [ ] User data filtered by user_id
- [ ] Error messages don't leak sensitive info

---

## Production Deployment Rules

### Pre-Deployment

1. All tests pass
2. Security audit clean: `npm audit`
3. Documentation updated
4. Environment variables configured
5. Database backups verified

### Deployment Process

1. Build Docker image: `docker build -t komcp:latest .`
2. Test locally: `docker-compose up`
3. Deploy to staging first
4. Run smoke tests on staging
5. Deploy to production
6. Monitor logs for 24 hours

### Rollback Plan

If issues occur:
1. Identify the issue (logs, metrics)
2. If critical, rollback:
   ```bash
   docker-compose down
   git checkout <previous-commit>
   docker-compose up -d
   ```
3. Investigate root cause
4. Fix in development
5. Re-deploy after thorough testing

---

## Communication & Collaboration

### Code Reviews

- All code should be reviewed before merging to main (if team grows)
- Review checklist:
  - Code follows style guide
  - Tests included and passing
  - Documentation updated
  - No security issues
  - Performance considered

### Issue Tracking

- Use GitHub Issues for bugs and feature requests
- Use clear, descriptive titles
- Include reproduction steps for bugs
- Link issues to commits/PRs

### Questions & Support

- Check documentation first (PRD, architecture, README)
- Search existing GitHub issues
- Ask specific questions with context

---

## Common Mistakes to Avoid

### ❌ Don't Do This

1. **Skip tests** - Always write tests alongside features
2. **Commit broken code** - Always run tests before committing
3. **Hardcode values** - Use environment variables
4. **Log secrets** - Sanitize logs
5. **Ignore errors** - Handle all error cases
6. **Skip documentation** - Update docs when code changes
7. **Use `any` type** - Define proper types
8. **Work on multiple tasks** - One task at a time
9. **Skip checklist updates** - Keep BUILD-CHECKLIST.md current
10. **Push to wrong branch** - Always use: `claude/komcp-mcp-server-01UPw1BPidQ2tS7gQKj7S9o2`

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build TypeScript
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run linter
npm run format       # Format code

# Database
npx prisma generate  # Generate Prisma client
npx prisma db pull   # Pull schema from database
npx prisma studio    # Open database GUI

# Docker
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose logs -f komcp   # View logs

# Git
git status                                                           # Check status
git add .                                                           # Stage changes
git commit -m "feat: description"                                  # Commit
git push -u origin claude/komcp-mcp-server-01UPw1BPidQ2tS7gQKj7S9o2  # Push
```

### File Locations Quick Reference

- **Environment:** `.env` (local), `.env.example` (template)
- **Configuration:** `src/config/`
- **Routes:** `src/routes/`
- **MCP Logic:** `src/mcp/`
- **Business Logic:** `src/services/`
- **Types:** `src/types/`
- **Tests:** `tests/unit/`, `tests/integration/`
- **Docker:** `docker/Dockerfile`, `docker/docker-compose.yml`
- **Documentation:** `*.md` in root

---

## Version History

- **v1.0** (2025-12-01): Initial version

---

**Remember:** Quality > Speed. Take time to do it right the first time.

When in doubt:
1. Consult the documentation (PRD, architecture, checklist)
2. Write tests
3. Ask for clarification
4. Follow these rules

Happy coding! 🚀
