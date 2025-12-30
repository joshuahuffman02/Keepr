/**
 * OAuth2 Types and Constants
 */

export enum OAuth2GrantType {
  CLIENT_CREDENTIALS = "client_credentials",
  AUTHORIZATION_CODE = "authorization_code",
  REFRESH_TOKEN = "refresh_token",
}

export enum OAuth2ResponseType {
  CODE = "code",
  TOKEN = "token",
}

export enum OAuth2Scope {
  // Resource scopes
  RESERVATIONS_READ = "reservations:read",
  RESERVATIONS_WRITE = "reservations:write",
  GUESTS_READ = "guests:read",
  GUESTS_WRITE = "guests:write",
  SITES_READ = "sites:read",
  SITES_WRITE = "sites:write",
  WEBHOOKS_READ = "webhooks:read",
  WEBHOOKS_WRITE = "webhooks:write",
  TOKENS_READ = "tokens:read",
  TOKENS_WRITE = "tokens:write",
  // Special scopes
  OFFLINE_ACCESS = "offline_access", // Allows refresh tokens
  OPENID = "openid", // OpenID Connect
  PROFILE = "profile", // User profile info
}

export const ALL_SCOPES = Object.values(OAuth2Scope);

export const DEFAULT_API_SCOPES: OAuth2Scope[] = [
  OAuth2Scope.RESERVATIONS_READ,
  OAuth2Scope.RESERVATIONS_WRITE,
  OAuth2Scope.GUESTS_READ,
  OAuth2Scope.GUESTS_WRITE,
  OAuth2Scope.SITES_READ,
  OAuth2Scope.SITES_WRITE,
  OAuth2Scope.WEBHOOKS_READ,
  OAuth2Scope.WEBHOOKS_WRITE,
  OAuth2Scope.TOKENS_READ,
  OAuth2Scope.TOKENS_WRITE,
];

export interface OAuth2TokenPayload {
  sub: string; // Subject (user ID or client ID)
  aud: string; // Audience (client ID)
  iss: string; // Issuer
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  scope: string; // Space-separated scopes
  campgroundId?: string;
  jti?: string; // JWT ID for token revocation
}

export interface OAuth2TokenResponse {
  token_type: "Bearer";
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  campground_id?: string;
}

export interface OAuth2AuthorizationRequest {
  client_id: string;
  response_type: OAuth2ResponseType;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string; // PKCE
  code_challenge_method?: "S256" | "plain";
  nonce?: string; // For OpenID Connect
}

export interface OAuth2AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
  userId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}

export interface OAuth2Client {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: OAuth2Scope[];
  grantTypes: OAuth2GrantType[];
  isConfidential: boolean; // True for server apps, false for public clients
  campgroundId: string;
}

export interface OAuth2Error {
  error: OAuth2ErrorCode;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

export type OAuth2ErrorCode =
  | "invalid_request"
  | "unauthorized_client"
  | "access_denied"
  | "unsupported_response_type"
  | "invalid_scope"
  | "server_error"
  | "temporarily_unavailable"
  | "invalid_client"
  | "invalid_grant"
  | "unsupported_grant_type"
  | "invalid_token"
  | "insufficient_scope";

/**
 * PKCE utilities
 */
export function generateCodeVerifier(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const crypto = require("crypto");
  const randomBytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export function generateCodeChallenge(verifier: string, method: "S256" | "plain" = "S256"): string {
  if (method === "plain") {
    return verifier;
  }
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

export function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: "S256" | "plain" = "S256"
): boolean {
  const computedChallenge = generateCodeChallenge(verifier, method);
  return computedChallenge === challenge;
}

/**
 * Scope utilities
 */
export function parseScopes(scopeString: string | undefined): string[] {
  if (!scopeString) return [];
  return scopeString.split(" ").map(s => s.trim()).filter(Boolean);
}

export function scopesToString(scopes: string[]): string {
  return scopes.join(" ");
}

export function validateScopes(requested: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  return requested.filter(scope => allowedSet.has(scope));
}
