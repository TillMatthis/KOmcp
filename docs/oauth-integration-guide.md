# KOauth OAuth2 Integration Guide

**Version:** 1.0
**Date:** 2025-12-01
**Target Audience:** Developers integrating KOmcp with KOauth

---

## Overview

This guide explains how KOmcp integrates with KOauth OAuth2 server to provide secure, standards-compliant authentication for remote MCP (Model Context Protocol) access from Claude and other LLM clients.

### Integration Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Claude    │         │    KOmcp     │         │   KOauth    │
│  (Client)   │         │ (Resource    │         │ (OAuth2     │
│             │         │  Server)     │         │  Server)    │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      │ 1. Request (no auth)   │                        │
      ├───────────────────────▶│                        │
      │                        │                        │
      │ 2. 401 + Metadata URL  │                        │
      │◀───────────────────────┤                        │
      │                        │                        │
      │ 3. GET /.well-known    │                        │
      ├───────────────────────▶│                        │
      │                        │                        │
      │ 4. Resource Metadata   │                        │
      │◀───────────────────────┤                        │
      │                        │                        │
      │ 5. Dynamic Client Reg  │                        │
      ├────────────────────────┼───────────────────────▶│
      │                        │                        │
      │ 6. Client Credentials  │                        │
      │◀───────────────────────┼────────────────────────┤
      │                        │                        │
      │ 7. Authorization Flow  │                        │
      ├────────────────────────┼───────────────────────▶│
      │                        │                        │
      │ 8. Access Token        │                        │
      │◀───────────────────────┼────────────────────────┤
      │                        │                        │
      │ 9. Request + Token     │                        │
      ├───────────────────────▶│                        │
      │                        │ 10. Verify Token       │
      │                        ├───────────────────────▶│
      │                        │     (JWKS)             │
      │                        │◀───────────────────────┤
      │                        │                        │
      │ 11. Response           │                        │
      │◀───────────────────────┤                        │
```

---

## OAuth2 Standards Compliance

KOmcp implements the following OAuth2 specifications:

1. **OAuth 2.1** - Latest OAuth framework with security best practices
2. **RFC 7591** - Dynamic Client Registration Protocol
3. **RFC 9728** - OAuth 2.0 Protected Resource Metadata
4. **RFC 7519** - JSON Web Token (JWT)
5. **RFC 7517** - JSON Web Key (JWK) for signature verification

---

## KOauth Prerequisites

Before integrating KOmcp with KOauth, ensure your KOauth server supports:

### Required Features

- ✅ **JWT Token Issuance** - Issue JWTs as access tokens
- ✅ **JWKS Endpoint** - Expose public keys at `/.well-known/jwks.json`
- ✅ **Dynamic Client Registration** - RFC 7591 endpoint at `/oauth/register`
- ✅ **Resource Server Support** - Validate resource server metadata
- ✅ **Scope Management** - Support custom scopes (e.g., `mcp:tools:read`)

### Required Scopes

KOmcp requires the following scopes to be configured in KOauth:

| Scope | Description | Required For |
|-------|-------------|--------------|
| `mcp:tools:read` | List available MCP tools | tools/list endpoint |
| `mcp:tools:execute` | Execute MCP tools | tools/call endpoint |
| `kura:notes:search` | Search Kura notes | search_kura_notes tool |

### JWT Token Claims

KOauth must include these claims in access tokens:

```json
{
  "sub": "user-123",                    // User ID (required)
  "client_id": "claude-abc123",         // OAuth client ID (required)
  "scope": "mcp:tools:read mcp:tools:execute kura:notes:search", // Space-separated (required)
  "exp": 1701432000,                    // Expiration timestamp (required)
  "iat": 1701428400,                    // Issued at timestamp (required)
  "iss": "https://auth.example.com",    // Issuer (must match KOAUTH_URL)
  "aud": "https://mcp.example.com"      // Audience (must match BASE_URL)
}
```

---

## KOmcp Configuration

### Environment Variables

Configure these variables in KOmcp's `.env` file:

```bash
# KOauth OAuth2 Server Integration
KOAUTH_URL=https://auth.example.com
KOAUTH_JWKS_URL=https://auth.example.com/.well-known/jwks.json
KOAUTH_CLIENT_REGISTRATION_URL=https://auth.example.com/oauth/register

# This server's public URL (for audience validation)
BASE_URL=https://mcp.example.com
```

### Validation Rules

KOmcp validates tokens with these rules:

1. **Signature Verification** - JWT signature must be valid (via JWKS)
2. **Expiration** - Token must not be expired (`exp` claim)
3. **Issuer** - Token issuer must match `KOAUTH_URL`
4. **Audience** - Token audience must match `BASE_URL`
5. **Scopes** - Token must include required scopes for the requested operation

---

## Protected Resource Metadata (RFC 9728)

KOmcp exposes OAuth metadata at `/.well-known/oauth-protected-resource` for clients to discover authentication requirements.

### Endpoint

```
GET /.well-known/oauth-protected-resource
```

### Response

```json
{
  "resource": "https://mcp.example.com",
  "authorization_servers": [
    "https://auth.example.com"
  ],
  "scopes_supported": [
    "mcp:tools:read",
    "mcp:tools:execute",
    "kura:notes:search"
  ],
  "bearer_methods_supported": [
    "header"
  ],
  "resource_documentation": "https://github.com/TillMatthis/KOmcp",
  "resource_signing_alg_values_supported": [
    "RS256"
  ]
}
```

### Fields Explained

- **resource** - Public URL of this MCP server
- **authorization_servers** - List of OAuth2 servers (KOauth URL)
- **scopes_supported** - Available scopes for this resource
- **bearer_methods_supported** - How to send token (only `header` supported)
- **resource_documentation** - Link to documentation
- **resource_signing_alg_values_supported** - JWT algorithms accepted (RS256)

---

## Dynamic Client Registration (RFC 7591)

Claude uses Dynamic Client Registration to obtain OAuth credentials without manual setup.

### Registration Flow

1. **Claude discovers registration endpoint** from resource metadata
2. **Claude sends registration request** to KOauth
3. **KOauth validates and creates client**
4. **KOauth returns client credentials**

### Registration Request (from Claude)

```http
POST /oauth/register HTTP/1.1
Host: auth.example.com
Content-Type: application/json

{
  "client_name": "Claude (MCP Client)",
  "client_uri": "https://claude.ai",
  "redirect_uris": [
    "https://claude.ai/api/mcp/auth_callback"
  ],
  "grant_types": [
    "authorization_code",
    "refresh_token"
  ],
  "response_types": ["code"],
  "scope": "mcp:tools:read mcp:tools:execute kura:notes:search",
  "token_endpoint_auth_method": "client_secret_basic"
}
```

### Registration Response (from KOauth)

```json
{
  "client_id": "claude_abc123xyz",
  "client_secret": "secret_...",
  "client_id_issued_at": 1701428400,
  "client_secret_expires_at": 0,
  "redirect_uris": [
    "https://claude.ai/api/mcp/auth_callback"
  ],
  "grant_types": [
    "authorization_code",
    "refresh_token"
  ],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_basic"
}
```

### KOauth Requirements for DCR

KOauth must:
- Accept registration requests without authentication (or with minimal auth)
- Validate `redirect_uris` against allowlist (e.g., `https://claude.ai/*`)
- Issue long-lived client credentials
- Store client metadata for future token requests

---

## Token Verification Flow

When Claude sends an MCP request with an access token, KOmcp performs these verification steps:

### Step 1: Extract Token

```typescript
const authHeader = request.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return 401; // Unauthorized
}
const token = authHeader.substring(7); // Remove "Bearer "
```

### Step 2: Fetch JWKS Keys

```typescript
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: process.env.KOAUTH_JWKS_URL!,
  cache: true,
  cacheMaxAge: 3600000 // Cache for 1 hour
});

const key = await client.getSigningKey(header.kid);
const publicKey = key.getPublicKey();
```

### Step 3: Verify JWT Signature

```typescript
import jwt from 'jsonwebtoken';

const decoded = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: process.env.KOAUTH_URL,
  audience: process.env.BASE_URL
});
```

### Step 4: Validate Scopes

```typescript
const claims = decoded as TokenClaims;
const scopes = claims.scope.split(' ');

const requiredScopes = ['mcp:tools:read', 'mcp:tools:execute'];
if (!requiredScopes.every(s => scopes.includes(s))) {
  return 403; // Forbidden - insufficient scopes
}
```

### Step 5: Attach User Context

```typescript
request.user = {
  userId: claims.sub,
  clientId: claims.client_id,
  scopes: scopes
};
```

---

## Error Handling

### 401 Unauthorized - Missing/Invalid Token

When a request arrives without a valid token, KOmcp returns:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="KOmcp MCP Server",
                  resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "error": "unauthorized",
  "error_description": "Missing or invalid access token"
}
```

### 403 Forbidden - Insufficient Scopes

When a token lacks required scopes:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "insufficient_scope",
  "error_description": "Token lacks required scopes: mcp:tools:execute",
  "scope": "mcp:tools:read mcp:tools:execute"
}
```

### Token Expiration

Expired tokens return:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token",
                  error_description="Token has expired"
Content-Type: application/json

{
  "error": "invalid_token",
  "error_description": "Token has expired"
}
```

---

## Security Considerations

### 1. Token Storage

- ✅ **KOmcp:** Does NOT store tokens (stateless validation)
- ✅ **Claude:** Stores tokens securely, refreshes when expired
- ⚠️ **Never log tokens** - Sanitize logs to remove Bearer tokens

### 2. JWKS Caching

- Cache JWKS keys for 1 hour to reduce load on KOauth
- Invalidate cache if signature verification fails
- Implement retry logic for JWKS fetch failures

### 3. Scope Validation

- Always validate scopes for each operation
- Use principle of least privilege
- Different tools may require different scopes

### 4. Rate Limiting

- Rate limit by `client_id` to prevent abuse
- Separate limits for token introspection vs tool execution

### 5. HTTPS Only

- All communication must use HTTPS (TLS 1.3)
- Reject HTTP requests in production
- Use valid SSL certificates

---

## Testing OAuth Integration

### Manual Testing with cURL

1. **Get Protected Resource Metadata:**

```bash
curl https://mcp.example.com/.well-known/oauth-protected-resource
```

2. **Register Client with KOauth:**

```bash
curl -X POST https://auth.example.com/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code"],
    "scope": "mcp:tools:read mcp:tools:execute"
  }'
```

3. **Get Authorization Code (via browser):**

```
https://auth.example.com/oauth/authorize?
  client_id=<client_id>&
  redirect_uri=http://localhost:8080/callback&
  response_type=code&
  scope=mcp:tools:read+mcp:tools:execute
```

4. **Exchange Code for Token:**

```bash
curl -X POST https://auth.example.com/oauth/token \
  -u "<client_id>:<client_secret>" \
  -d "grant_type=authorization_code" \
  -d "code=<authorization_code>" \
  -d "redirect_uri=http://localhost:8080/callback"
```

5. **Make MCP Request:**

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

### Automated Integration Tests

See `tests/integration/oauth-flow.test.ts` for complete test suite.

---

## Troubleshooting

### Issue: "Invalid signature"

**Cause:** Public key from JWKS doesn't match token signature

**Solutions:**
- Verify JWKS endpoint returns correct keys
- Check `kid` (key ID) in JWT header matches JWKS
- Ensure KOauth uses RS256 algorithm
- Clear JWKS cache and retry

### Issue: "Invalid issuer"

**Cause:** Token `iss` claim doesn't match `KOAUTH_URL`

**Solutions:**
- Verify `KOAUTH_URL` in KOmcp .env matches KOauth's issuer
- Check KOauth configuration for issuer URL
- Ensure no trailing slashes in URLs

### Issue: "Invalid audience"

**Cause:** Token `aud` claim doesn't match `BASE_URL`

**Solutions:**
- Verify `BASE_URL` in KOmcp .env is correct
- Check KOauth issues tokens with correct audience
- Ensure audience matches public URL (not localhost in prod)

### Issue: "Insufficient scopes"

**Cause:** Token doesn't include required scopes

**Solutions:**
- Request correct scopes during authorization
- Verify KOauth grants requested scopes
- Check scope configuration in KOauth

---

## KOauth Setup Checklist

Before deploying KOmcp, ensure KOauth has:

- [ ] JWKS endpoint configured and accessible
- [ ] Dynamic Client Registration endpoint enabled
- [ ] Required scopes defined:
  - [ ] `mcp:tools:read`
  - [ ] `mcp:tools:execute`
  - [ ] `kura:notes:search`
- [ ] JWT token issuance configured
- [ ] Token expiration set (recommended: 1 hour)
- [ ] Refresh token support enabled
- [ ] Redirect URI allowlist includes `https://claude.ai/api/mcp/auth_callback`
- [ ] CORS configured to allow Claude's origin
- [ ] Rate limiting configured for token endpoints

---

## Integration Sequence Diagram

```
Claude               KOmcp                    KOauth
  │                    │                         │
  │  1. tools/list     │                         │
  ├────────────────────▶                         │
  │  (no auth)         │                         │
  │                    │                         │
  │  2. 401 + metadata │                         │
  │◀────────────────────                         │
  │                    │                         │
  │  3. GET metadata   │                         │
  ├────────────────────▶                         │
  │                    │                         │
  │  4. OAuth config   │                         │
  │◀────────────────────                         │
  │                    │                         │
  │  5. Register client                          │
  ├──────────────────────────────────────────────▶
  │                    │                         │
  │  6. client_id/secret                         │
  │◀──────────────────────────────────────────────
  │                    │                         │
  │  7. Authorize      │                         │
  ├──────────────────────────────────────────────▶
  │  (user consent)    │                         │
  │                    │                         │
  │  8. Token          │                         │
  │◀──────────────────────────────────────────────
  │                    │                         │
  │  9. tools/list     │                         │
  │  + Bearer token    │                         │
  ├────────────────────▶                         │
  │                    │  10. Verify JWT         │
  │                    ├────────────────────────▶│
  │                    │  (JWKS lookup)          │
  │                    │◀────────────────────────│
  │                    │  Valid                  │
  │  11. Tool list     │                         │
  │◀────────────────────                         │
  │                    │                         │
```

---

## Related Documentation

- [KOauth OAuth2 Server](https://github.com/TillMatthis/KOauth) - OAuth server implementation
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)

---

**Last Updated:** 2025-12-01
