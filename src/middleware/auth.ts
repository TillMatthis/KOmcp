import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, TokenValidationError } from '../services/oauth';
import { UserContext } from '../types/auth';
import { config } from '../config/env';

/**
 * Extend Fastify request type to include user context
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
  }
}

/**
 * Build WWW-Authenticate header value for 401 responses
 *
 * @param error - Optional error code
 * @param errorDescription - Optional error description
 * @returns WWW-Authenticate header value
 */
function buildWWWAuthenticateHeader(error?: string, errorDescription?: string): string {
  const parts = ['Bearer realm="KOmcp MCP Server"'];

  // Add resource metadata URL for OAuth discovery
  parts.push(`resource_metadata="${config.BASE_URL}/.well-known/oauth-protected-resource"`);

  // Add error information if provided
  if (error) {
    parts.push(`error="${error}"`);
  }
  if (errorDescription) {
    parts.push(`error_description="${errorDescription}"`);
  }

  return parts.join(', ');
}

/**
 * Authentication middleware for OAuth2 Bearer token validation
 *
 * This middleware:
 * 1. Extracts the Bearer token from the Authorization header
 * 2. Verifies the token signature, expiration, and claims
 * 3. Attaches user context to the request for use in route handlers
 * 4. Returns 401 Unauthorized if the token is missing or invalid
 *
 * Usage:
 *   server.get('/protected', { preHandler: authMiddleware }, async (request, reply) => {
 *     const userId = request.user!.userId;
 *     // ...
 *   });
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  // Check if Authorization header is present
  if (!authHeader) {
    reply.status(401).header('WWW-Authenticate', buildWWWAuthenticateHeader()).send({
      error: 'unauthorized',
      error_description: 'Missing Authorization header',
    });
    return;
  }

  // Check if it's a Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    reply
      .status(401)
      .header(
        'WWW-Authenticate',
        buildWWWAuthenticateHeader('invalid_token', 'Authorization header must use Bearer scheme')
      )
      .send({
        error: 'invalid_token',
        error_description: 'Authorization header must use Bearer scheme',
      });
    return;
  }

  // Extract token (remove "Bearer " prefix)
  const token = authHeader.substring(7);

  if (!token) {
    reply
      .status(401)
      .header('WWW-Authenticate', buildWWWAuthenticateHeader('invalid_token', 'Token is empty'))
      .send({
        error: 'invalid_token',
        error_description: 'Token is empty',
      });
    return;
  }

  // Verify the token
  try {
    const claims = await verifyToken(token);

    // Attach user context to request for use in handlers
    request.user = {
      userId: claims.sub,
      clientId: claims.client_id,
      scopes: claims.scope.split(' '),
    };

    // Log successful authentication (without token)
    request.log.debug(
      {
        userId: request.user.userId,
        clientId: request.user.clientId,
        scopes: request.user.scopes,
      },
      'Request authenticated'
    );
  } catch (error) {
    if (error instanceof TokenValidationError) {
      // Map our error codes to OAuth error responses
      reply
        .status(401)
        .header('WWW-Authenticate', buildWWWAuthenticateHeader(error.code, error.message))
        .send({
          error: error.code,
          error_description: error.message,
        });
      return;
    }

    // Unexpected error during token validation
    request.log.error({ error }, 'Unexpected error during token validation');
    reply
      .status(401)
      .header('WWW-Authenticate', buildWWWAuthenticateHeader('invalid_token', 'Token validation failed'))
      .send({
        error: 'invalid_token',
        error_description: 'Token validation failed',
      });
  }
}

/**
 * Create a scope-checking middleware
 *
 * Returns a middleware function that checks if the authenticated user
 * has all of the required scopes. Must be used after authMiddleware.
 *
 * @param requiredScopes - Array of required scope strings
 * @returns Fastify preHandler middleware function
 *
 * Usage:
 *   server.post('/mcp', {
 *     preHandler: [authMiddleware, requireScopes(['mcp:tools:read', 'mcp:tools:execute'])]
 *   }, async (request, reply) => {
 *     // User has required scopes
 *   });
 */
export function requireScopes(requiredScopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Ensure authMiddleware ran first
    if (!request.user) {
      reply.status(401).send({
        error: 'unauthorized',
        error_description: 'Authentication required',
      });
      return;
    }

    // Check if user has all required scopes
    const hasAllScopes = requiredScopes.every((scope) => request.user!.scopes.includes(scope));

    if (!hasAllScopes) {
      const missingScopes = requiredScopes.filter((scope) => !request.user!.scopes.includes(scope));

      reply.status(403).send({
        error: 'insufficient_scope',
        error_description: `Token lacks required scopes: ${missingScopes.join(', ')}`,
        scope: requiredScopes.join(' '),
      });
      return;
    }
  };
}
