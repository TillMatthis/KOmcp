import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';
import { RequiredScope } from '../types/auth';

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * This endpoint allows OAuth clients (like Claude) to discover
 * the authorization requirements for this resource server.
 */
interface ProtectedResourceMetadata {
  /** Resource server identifier (this server's public URL) */
  resource: string;
  /** List of authorization server URLs that can issue tokens for this resource */
  authorization_servers: string[];
  /** OAuth scopes supported by this resource server */
  scopes_supported: string[];
  /** Methods for presenting bearer tokens (only 'header' is supported) */
  bearer_methods_supported: string[];
  /** Link to resource server documentation */
  resource_documentation?: string;
  /** JWT signing algorithms supported for token validation */
  resource_signing_alg_values_supported: string[];
}

/**
 * Register well-known OAuth endpoints
 */
export async function wellKnownRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /.well-known/oauth-protected-resource
   *
   * Returns OAuth 2.0 Protected Resource Metadata per RFC 9728
   * This allows clients to discover:
   * - Which authorization server to use (KOauth)
   * - What scopes are required
   * - How to present access tokens
   */
  server.get(
    '/.well-known/oauth-protected-resource',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              resource: { type: 'string' },
              authorization_servers: {
                type: 'array',
                items: { type: 'string' },
              },
              scopes_supported: {
                type: 'array',
                items: { type: 'string' },
              },
              bearer_methods_supported: {
                type: 'array',
                items: { type: 'string' },
              },
              resource_documentation: { type: 'string' },
              resource_signing_alg_values_supported: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const metadata: ProtectedResourceMetadata = {
        resource: config.BASE_URL,
        authorization_servers: [config.KOAUTH_URL],
        scopes_supported: [
          RequiredScope.TOOLS_READ,
          RequiredScope.TOOLS_EXECUTE,
          RequiredScope.KURA_NOTES_SEARCH,
        ],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://github.com/TillMatthis/KOmcp',
        resource_signing_alg_values_supported: ['RS256'],
      };

      // Cache this response for 1 hour (it rarely changes)
      reply.header('Cache-Control', 'public, max-age=3600');

      return metadata;
    }
  );
}
