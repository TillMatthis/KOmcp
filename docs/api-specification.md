# KOmcp API Specification

**Version:** 1.0.0
**Date:** 2025-12-01
**Base URL:** `https://mcp.example.com`
**Protocol:** JSON-RPC 2.0 over HTTP

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Public Endpoints](#public-endpoints)
4. [Protected Endpoints](#protected-endpoints)
5. [MCP Tools](#mcp-tools)
6. [Error Codes](#error-codes)
7. [Examples](#examples)

---

## Overview

KOmcp implements the Model Context Protocol (MCP) specification over HTTP, providing access to Kura notes semantic search functionality via OAuth2-authenticated JSON-RPC 2.0 requests.

### Protocol

- **Transport:** HTTP/1.1 or HTTP/2
- **Message Format:** JSON-RPC 2.0
- **Authentication:** OAuth 2.1 with Bearer tokens
- **Content-Type:** `application/json`

### Base URLs

- **Production:** `https://mcp.example.com`
- **Staging:** `https://mcp-staging.example.com`
- **Development:** `http://localhost:3003`

---

## Authentication

All protected endpoints require OAuth2 Bearer token authentication.

### Authorization Header

```http
Authorization: Bearer <access_token>
```

### Getting an Access Token

See [OAuth Integration Guide](./oauth-integration-guide.md) for complete flow.

**Quick Summary:**
1. Discover OAuth endpoints via `/.well-known/oauth-protected-resource`
2. Register client with KOauth (Dynamic Client Registration)
3. Complete OAuth authorization flow
4. Receive access token
5. Include token in `Authorization` header

### Required Scopes

| Endpoint | Required Scopes |
|----------|----------------|
| `tools/list` | `mcp:tools:read` |
| `tools/call` | `mcp:tools:read`, `mcp:tools:execute` |
| `search_kura_notes` | `kura:notes:search` |

---

## Public Endpoints

### 1. Health Check

Check server health and status.

#### Request

```http
GET /health HTTP/1.1
Host: mcp.example.com
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2025-12-01T12:00:00.000Z",
  "uptime": 12345.67,
  "version": "1.0.0"
}
```

#### Fields

- `status` - Health status: `healthy` or `unhealthy`
- `timestamp` - Current server time (ISO 8601)
- `uptime` - Server uptime in seconds
- `version` - API version

#### Error Response (Unhealthy)

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "unhealthy",
  "checks": {
    "database": "failed",
    "koauth": "ok"
  }
}
```

---

### 2. OAuth Protected Resource Metadata

Discover OAuth authentication requirements (RFC 9728).

#### Request

```http
GET /.well-known/oauth-protected-resource HTTP/1.1
Host: mcp.example.com
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

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

#### Fields

- `resource` - Resource server identifier (this server's URL)
- `authorization_servers` - Array of OAuth2 server URLs
- `scopes_supported` - Available scopes for this resource
- `bearer_methods_supported` - How to send token (only `header`)
- `resource_documentation` - Link to API documentation
- `resource_signing_alg_values_supported` - JWT algorithms accepted

---

## Protected Endpoints

### 3. MCP Main Endpoint

JSON-RPC 2.0 endpoint for all MCP operations.

#### Request

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "<method_name>",
  "params": { ... },
  "id": 1
}
```

#### Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": { ... },
  "id": 1
}
```

#### Response (Error)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { ... }
  },
  "id": 1
}
```

#### Supported Methods

1. `tools/list` - List available MCP tools
2. `tools/call` - Execute an MCP tool

---

### 4. List Tools (tools/list)

List all available MCP tools.

#### Request

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 1
}
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "search_kura_notes",
        "description": "Search Kura notes using semantic similarity",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Natural language search query"
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
      }
    ]
  },
  "id": 1
}
```

#### Required Scopes

- `mcp:tools:read`

---

### 5. Call Tool (tools/call)

Execute a specific MCP tool.

#### Request

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_kura_notes",
    "arguments": {
      "query": "machine learning algorithms",
      "limit": 10,
      "min_similarity": 0.7
    }
  },
  "id": 2
}
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 notes matching 'machine learning algorithms':\n\n1. **Introduction to ML** (similarity: 0.92)\n   Machine learning is a subset of artificial intelligence...\n\n2. **Common ML Algorithms** (similarity: 0.88)\n   Decision trees, random forests, neural networks...\n\n3. **Supervised Learning** (similarity: 0.75)\n   Algorithms that learn from labeled data..."
      }
    ],
    "isError": false
  },
  "id": 2
}
```

#### Required Scopes

- `mcp:tools:read`
- `mcp:tools:execute`
- `kura:notes:search`

---

## MCP Tools

### search_kura_notes

Search Kura notes using semantic similarity (vector embeddings).

#### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Natural language search query |
| `limit` | number | No | 10 | Maximum results (1-50) |
| `min_similarity` | number | No | 0.7 | Similarity threshold (0-1) |

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language search query",
      "minLength": 1,
      "maxLength": 1000
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results",
      "minimum": 1,
      "maximum": 50,
      "default": 10
    },
    "min_similarity": {
      "type": "number",
      "description": "Minimum cosine similarity threshold",
      "minimum": 0,
      "maximum": 1,
      "default": 0.7
    }
  },
  "required": ["query"]
}
```

#### Output Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "<formatted search results>"
    }
  ],
  "isError": false
}
```

#### Internal Result Structure (for reference)

The tool internally returns:

```json
{
  "results": [
    {
      "id": "note-abc123",
      "title": "Note Title",
      "content": "Note content...",
      "similarity": 0.92,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-02-20T14:45:00Z"
    }
  ],
  "total": 3,
  "query_embedding_time_ms": 45,
  "search_time_ms": 12
}
```

#### Example Request

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_kura_notes",
    "arguments": {
      "query": "How to deploy Docker containers?",
      "limit": 5,
      "min_similarity": 0.8
    }
  },
  "id": 3
}
```

#### Example Response

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 2 notes matching 'How to deploy Docker containers?':\n\n1. **Docker Deployment Guide** (similarity: 0.91)\n   Step-by-step guide to deploying applications using Docker...\n\n2. **Container Orchestration** (similarity: 0.83)\n   Using Docker Compose and Kubernetes for container management..."
      }
    ],
    "isError": false
  },
  "id": 3
}
```

#### Error Cases

**Invalid query (empty):**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "query",
      "reason": "Query cannot be empty"
    }
  },
  "id": 3
}
```

**Limit out of range:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "limit",
      "reason": "Limit must be between 1 and 50"
    }
  },
  "id": 3
}
```

**No results found:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "No notes found matching 'your query'. Try:\n- Using different keywords\n- Lowering the similarity threshold\n- Checking if notes exist in your account"
      }
    ],
    "isError": false
  },
  "id": 3
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful (check JSON-RPC response) |
| 401 | Unauthorized | Missing or invalid access token |
| 403 | Forbidden | Insufficient scopes |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Server unhealthy |

### JSON-RPC Error Codes

Standard JSON-RPC 2.0 error codes:

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON received |
| -32600 | Invalid Request | JSON-RPC request invalid |
| -32601 | Method not found | Method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |

Custom error codes:

| Code | Message | Description |
|------|---------|-------------|
| -32000 | Server error | Generic server error |
| -32001 | Database error | Database query failed |
| -32002 | Embedding error | Embedding generation failed |
| -32003 | Authorization error | OAuth authorization failed |

### HTTP 401 - Unauthorized

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

### HTTP 403 - Forbidden (Insufficient Scopes)

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "insufficient_scope",
  "error_description": "Token lacks required scopes: mcp:tools:execute",
  "scope": "mcp:tools:read mcp:tools:execute"
}
```

### HTTP 429 - Rate Limit Exceeded

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1701432060
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests. Limit: 100 requests per minute.",
  "retry_after": 60
}
```

### HTTP 500 - Internal Server Error

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "internal_error",
  "error_description": "An unexpected error occurred. Please try again later."
}
```

---

## Examples

### Example 1: Complete Flow (First Request)

**Step 1: Request without auth (triggers OAuth discovery)**

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**Response:**
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="KOmcp",
                  resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"

{
  "error": "unauthorized",
  "error_description": "Missing access token"
}
```

**Step 2: Discover OAuth endpoints**

```bash
curl https://mcp.example.com/.well-known/oauth-protected-resource
```

**Response:**
```json
{
  "resource": "https://mcp.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["mcp:tools:read", "mcp:tools:execute", "kura:notes:search"]
}
```

**Step 3: Complete OAuth flow (see OAuth Integration Guide)**

**Step 4: Retry with access token**

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "search_kura_notes",
        "description": "Search Kura notes using semantic similarity",
        "inputSchema": { ... }
      }
    ]
  },
  "id": 1
}
```

---

### Example 2: Search Notes

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_kura_notes",
      "arguments": {
        "query": "Python async programming best practices",
        "limit": 5,
        "min_similarity": 0.75
      }
    },
    "id": 2
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 notes matching 'Python async programming best practices':\n\n1. **Async/Await in Python** (similarity: 0.89)\n   Modern Python async programming using asyncio...\n\n2. **Concurrent Programming Patterns** (similarity: 0.82)\n   Best practices for writing concurrent Python code...\n\n3. **Event Loop Optimization** (similarity: 0.77)\n   Tips for optimizing asyncio event loops..."
      }
    ],
    "isError": false
  },
  "id": 2
}
```

---

### Example 3: Batch Requests (JSON-RPC Batch)

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '[
    {
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    },
    {
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "search_kura_notes",
        "arguments": {
          "query": "Docker"
        }
      },
      "id": 2
    }
  ]'
```

**Response:**
```json
[
  {
    "jsonrpc": "2.0",
    "result": {
      "tools": [...]
    },
    "id": 1
  },
  {
    "jsonrpc": "2.0",
    "result": {
      "content": [...]
    },
    "id": 2
  }
]
```

---

### Example 4: Error Handling

**Invalid method:**

```bash
curl -X POST https://mcp.example.com/mcp \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "invalid/method",
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "method": "invalid/method"
    }
  },
  "id": 1
}
```

---

## Rate Limiting

### Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701432060
```

### Limits

- **Default:** 100 requests per minute per client
- **Burst:** Up to 10 requests per second
- **Key:** Based on `client_id` from OAuth token

### Exceeding Limits

When rate limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1701432060

{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests. Please wait 42 seconds."
}
```

---

## Versioning

API version is included in all responses via the `X-API-Version` header:

```http
X-API-Version: 1.0.0
```

### Version Format

- **Major.Minor.Patch** (Semantic Versioning)
- **Breaking changes:** Increment major version
- **New features:** Increment minor version
- **Bug fixes:** Increment patch version

---

## CORS

CORS is configured to allow requests from Claude:

```http
Access-Control-Allow-Origin: https://claude.ai
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

---

## Security Headers

All responses include security headers:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## Testing with Postman/Insomnia

### Postman Collection

Import this collection for testing:

```json
{
  "info": {
    "name": "KOmcp API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "OAuth Metadata",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/.well-known/oauth-protected-resource"
      }
    },
    {
      "name": "List Tools",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/mcp",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"jsonrpc\": \"2.0\",\n  \"method\": \"tools/list\",\n  \"id\": 1\n}"
        }
      }
    },
    {
      "name": "Search Notes",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/mcp",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"jsonrpc\": \"2.0\",\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \"search_kura_notes\",\n    \"arguments\": {\n      \"query\": \"machine learning\",\n      \"limit\": 10\n    }\n  },\n  \"id\": 2\n}"
        }
      }
    }
  ]
}
```

### Environment Variables

```json
{
  "base_url": "https://mcp.example.com",
  "access_token": "your_access_token_here"
}
```

---

## Related Documentation

- [OAuth Integration Guide](./oauth-integration-guide.md) - OAuth2 authentication setup
- [Deployment Guide](./deployment-guide.md) - Production deployment instructions
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18) - Official MCP protocol spec

---

**Last Updated:** 2025-12-01
**API Version:** 1.0.0
