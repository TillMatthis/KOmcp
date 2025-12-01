import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config/env';
import { TokenClaims, RequiredScope } from '../types/auth';

/**
 * JWKS client for fetching public keys from KOauth
 * Keys are cached for 1 hour to reduce load on the authorization server
 */
const client = jwksClient({
  jwksUri: config.KOAUTH_JWKS_URL,
  cache: true,
  cacheMaxAge: 3600000, // 1 hour in milliseconds
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

/**
 * Get signing key from JWKS
 * @param header - JWT header containing key ID (kid)
 * @param callback - Callback function for async key retrieval
 */
function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Custom error class for OAuth token validation errors
 */
export class TokenValidationError extends Error {
  constructor(
    message: string,
    public code:
      | 'invalid_token'
      | 'token_expired'
      | 'invalid_signature'
      | 'invalid_issuer'
      | 'invalid_audience'
      | 'insufficient_scope'
  ) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

/**
 * Verify and decode a JWT access token from KOauth
 *
 * This function performs comprehensive token validation:
 * 1. Verifies JWT signature using JWKS public keys
 * 2. Checks token expiration
 * 3. Validates issuer (must be KOauth)
 * 4. Validates audience (must be this server)
 * 5. Ensures required claims are present
 *
 * @param token - JWT access token (without "Bearer " prefix)
 * @returns Decoded and validated token claims
 * @throws {TokenValidationError} If token validation fails
 */
export async function verifyToken(token: string): Promise<TokenClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        algorithms: ['RS256'], // Only accept RS256 (RSA + SHA256)
        issuer: config.KOAUTH_URL, // Token must be issued by KOauth
        audience: config.BASE_URL, // Token must be intended for this server
        clockTolerance: 30, // Allow 30 seconds clock skew
      },
      (err, decoded) => {
        // Handle verification errors
        if (err) {
          if (err.name === 'TokenExpiredError') {
            reject(new TokenValidationError('Token has expired', 'token_expired'));
            return;
          }
          if (err.name === 'JsonWebTokenError') {
            if (err.message.includes('invalid signature')) {
              reject(new TokenValidationError('Invalid token signature', 'invalid_signature'));
              return;
            }
            if (err.message.includes('invalid issuer')) {
              reject(new TokenValidationError('Invalid token issuer', 'invalid_issuer'));
              return;
            }
            if (err.message.includes('invalid audience')) {
              reject(new TokenValidationError('Invalid token audience', 'invalid_audience'));
              return;
            }
          }
          // Generic token error
          reject(new TokenValidationError(err.message, 'invalid_token'));
          return;
        }

        // Ensure decoded token has required structure
        if (!decoded || typeof decoded !== 'object') {
          reject(new TokenValidationError('Invalid token payload', 'invalid_token'));
          return;
        }

        const claims = decoded as TokenClaims;

        // Validate required claims are present
        if (!claims.sub || !claims.client_id || !claims.scope) {
          reject(
            new TokenValidationError('Token missing required claims (sub, client_id, scope)', 'invalid_token')
          );
          return;
        }

        resolve(claims);
      }
    );
  });
}

/**
 * Check if a token has the required scopes
 *
 * @param claims - Validated token claims
 * @param requiredScopes - Array of required scope strings
 * @returns True if all required scopes are present
 */
export function hasRequiredScopes(claims: TokenClaims, requiredScopes: RequiredScope[]): boolean {
  const tokenScopes = claims.scope.split(' ');
  return requiredScopes.every((required) => tokenScopes.includes(required));
}

/**
 * Validate token and check for required scopes
 *
 * Convenience function that combines token verification and scope checking
 *
 * @param token - JWT access token
 * @param requiredScopes - Array of required scopes
 * @returns Validated token claims
 * @throws {TokenValidationError} If token is invalid or lacks required scopes
 */
export async function verifyTokenWithScopes(
  token: string,
  requiredScopes: RequiredScope[]
): Promise<TokenClaims> {
  // First verify the token itself
  const claims = await verifyToken(token);

  // Then check if it has the required scopes
  if (!hasRequiredScopes(claims, requiredScopes)) {
    const missing = requiredScopes.filter((scope) => !claims.scope.includes(scope));
    throw new TokenValidationError(
      `Token lacks required scopes: ${missing.join(', ')}`,
      'insufficient_scope'
    );
  }

  return claims;
}
