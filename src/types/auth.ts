/**
 * OAuth2 and Authentication Types
 */

/**
 * JWT token claims from KOauth access tokens
 */
export interface TokenClaims {
  /** User ID (subject) */
  sub: string;
  /** OAuth client ID */
  client_id: string;
  /** Space-separated scopes granted to the token */
  scope: string;
  /** Token expiration timestamp (Unix epoch) */
  exp: number;
  /** Token issued at timestamp (Unix epoch) */
  iat: number;
  /** Issuer (KOauth URL) */
  iss: string;
  /** Audience (KOmcp URL) */
  aud: string;
}

/**
 * User context attached to authenticated requests
 */
export interface UserContext {
  /** User ID from token */
  userId: string;
  /** OAuth client ID */
  clientId: string;
  /** Array of granted scopes */
  scopes: string[];
}

/**
 * Required scopes for different operations
 */
export enum RequiredScope {
  /** List available MCP tools */
  TOOLS_READ = 'mcp:tools:read',
  /** Execute MCP tools */
  TOOLS_EXECUTE = 'mcp:tools:execute',
  /** Search Kura notes */
  KURA_NOTES_SEARCH = 'kura:notes:search',
}

/**
 * OAuth error types
 */
export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * WWW-Authenticate header parameters for 401 responses
 */
export interface WWWAuthenticateParams {
  realm?: string;
  resource_metadata?: string;
  error?: string;
  error_description?: string;
}
