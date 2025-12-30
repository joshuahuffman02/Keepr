import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { randomBytes, createHash } from "crypto";
import * as bcrypt from "bcryptjs";
import {
  OAuth2GrantType,
  OAuth2TokenResponse,
  OAuth2Scope,
  DEFAULT_API_SCOPES,
  parseScopes,
  scopesToString,
  validateScopes,
  verifyCodeChallenge,
  OAuth2ErrorCode,
} from "./oauth2.types";

interface TokenGenerationResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string[];
}

interface AuthorizationCodeData {
  clientId: string;
  redirectUri: string;
  scope: string[];
  userId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/**
 * OAuth2 Service
 *
 * Implements OAuth2 token generation, validation, and management.
 * Supports:
 * - Client Credentials grant
 * - Authorization Code grant with PKCE
 * - Token refresh
 * - Token revocation
 * - Token introspection
 */
@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly authCodeTtl: number;
  private readonly issuer: string;

  // In-memory store for authorization codes (TODO: move to Redis for production)
  private readonly authCodes = new Map<string, { data: AuthorizationCodeData; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {
    this.accessTokenTtl = this.config.get<number>("OAUTH2_ACCESS_TOKEN_TTL", 3600); // 1 hour
    this.refreshTokenTtl = this.config.get<number>("OAUTH2_REFRESH_TOKEN_TTL", 2592000); // 30 days
    this.authCodeTtl = this.config.get<number>("OAUTH2_AUTH_CODE_TTL", 600); // 10 minutes
    this.issuer = this.config.get<string>("OAUTH2_ISSUER", "https://api.campreserv.com");
  }

  /**
   * Issue tokens using client credentials grant
   */
  async issueClientCredentialsToken(opts: {
    clientId: string;
    clientSecret: string;
    scope?: string;
  }): Promise<OAuth2TokenResponse> {
    // Validate client
    const client = await this.validateClient(opts.clientId, opts.clientSecret);

    // Validate scopes
    const requestedScopes = parseScopes(opts.scope);
    const allowedScopes = client.scopes || DEFAULT_API_SCOPES.map(s => s as string);
    const grantedScopes = requestedScopes.length > 0
      ? validateScopes(requestedScopes, allowedScopes)
      : allowedScopes;

    if (grantedScopes.length === 0 && requestedScopes.length > 0) {
      this.throwOAuth2Error("invalid_scope", "None of the requested scopes are allowed");
    }

    // Generate tokens
    const tokens = await this.generateTokens(client.id, client.campgroundId, grantedScopes);

    // Store token in database
    await this.persistToken(client.id, tokens, grantedScopes);

    return {
      token_type: "Bearer",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      scope: scopesToString(grantedScopes),
      campground_id: client.campgroundId,
    };
  }

  /**
   * Generate authorization code for authorization code flow
   */
  async generateAuthorizationCode(opts: {
    clientId: string;
    redirectUri: string;
    scope: string[];
    userId?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<string> {
    // Validate client and redirect URI
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: opts.clientId },
    });

    if (!client || !client.isActive) {
      this.throwOAuth2Error("invalid_client", "Invalid client");
    }

    const redirectUris = client.redirectUris || [];
    if (!redirectUris.includes(opts.redirectUri)) {
      this.throwOAuth2Error("invalid_request", "Invalid redirect_uri");
    }

    // For public clients, PKCE is required
    if (!client.isConfidential && !opts.codeChallenge) {
      this.throwOAuth2Error("invalid_request", "PKCE code_challenge is required for public clients");
    }

    // Generate authorization code
    const code = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + this.authCodeTtl * 1000;

    // Store code (TODO: move to Redis)
    this.authCodes.set(code, {
      data: {
        clientId: opts.clientId,
        redirectUri: opts.redirectUri,
        scope: opts.scope,
        userId: opts.userId,
        codeChallenge: opts.codeChallenge,
        codeChallengeMethod: opts.codeChallengeMethod,
      },
      expiresAt,
    });

    // Clean up expired codes
    this.cleanupAuthCodes();

    return code;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthorizationCode(opts: {
    code: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuth2TokenResponse> {
    // Retrieve and validate authorization code
    const codeEntry = this.authCodes.get(opts.code);
    if (!codeEntry || codeEntry.expiresAt < Date.now()) {
      this.authCodes.delete(opts.code);
      this.throwOAuth2Error("invalid_grant", "Invalid or expired authorization code");
    }

    const codeData = codeEntry.data;

    // Code can only be used once
    this.authCodes.delete(opts.code);

    // Validate client ID matches
    if (codeData.clientId !== opts.clientId) {
      this.throwOAuth2Error("invalid_grant", "Client ID mismatch");
    }

    // Validate redirect URI matches
    if (codeData.redirectUri !== opts.redirectUri) {
      this.throwOAuth2Error("invalid_grant", "Redirect URI mismatch");
    }

    // Validate client
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: opts.clientId },
    });

    if (!client || !client.isActive) {
      this.throwOAuth2Error("invalid_client", "Invalid client");
    }

    // For confidential clients, validate secret
    if (client.isConfidential) {
      if (!opts.clientSecret) {
        this.throwOAuth2Error("invalid_client", "Client secret required");
      }
      const secretValid = await bcrypt.compare(opts.clientSecret, client.clientSecretHash || "");
      if (!secretValid) {
        this.throwOAuth2Error("invalid_client", "Invalid client credentials");
      }
    }

    // Validate PKCE if code challenge was used
    if (codeData.codeChallenge) {
      if (!opts.codeVerifier) {
        this.throwOAuth2Error("invalid_grant", "PKCE code_verifier required");
      }
      const method = (codeData.codeChallengeMethod as "S256" | "plain") || "S256";
      if (!verifyCodeChallenge(opts.codeVerifier, codeData.codeChallenge, method)) {
        this.throwOAuth2Error("invalid_grant", "Invalid code_verifier");
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(client.id, client.campgroundId, codeData.scope, codeData.userId);

    // Store token in database
    await this.persistToken(client.id, tokens, codeData.scope, codeData.userId);

    return {
      token_type: "Bearer",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      scope: scopesToString(codeData.scope),
      campground_id: client.campgroundId,
    };
  }

  /**
   * Refresh an access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2TokenResponse> {
    const tokenHash = this.hashToken(refreshToken);

    const token = await this.prisma.oAuthToken.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        refreshExpiresAt: { gt: new Date() },
      },
      include: { oAuthClient: true },
    });

    if (!token || !token.oAuthClient || !token.oAuthClient.isActive) {
      this.throwOAuth2Error("invalid_grant", "Invalid refresh token");
    }

    // Generate new tokens
    const scopes = token.scopes || [];
    const tokens = await this.generateTokens(
      token.oAuthClientId,
      token.oAuthClient.campgroundId,
      scopes,
      token.userId || undefined
    );

    // Revoke old token
    await this.prisma.oAuthToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    // Store new token
    await this.persistToken(token.oAuthClientId, tokens, scopes, token.userId || undefined);

    return {
      token_type: "Bearer",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      scope: scopesToString(scopes),
      campground_id: token.oAuthClient.campgroundId,
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string, tokenTypeHint?: "access_token" | "refresh_token"): Promise<void> {
    const tokenHash = this.hashToken(token);

    // Try to find by access token first if hinted or not specified
    if (!tokenTypeHint || tokenTypeHint === "access_token") {
      const accessToken = await this.prisma.oAuthToken.findFirst({
        where: { accessTokenHash: tokenHash, revokedAt: null },
      });
      if (accessToken) {
        await this.prisma.oAuthToken.update({
          where: { id: accessToken.id },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }

    // Try refresh token
    if (!tokenTypeHint || tokenTypeHint === "refresh_token") {
      const refreshToken = await this.prisma.oAuthToken.findFirst({
        where: { refreshTokenHash: tokenHash, revokedAt: null },
      });
      if (refreshToken) {
        await this.prisma.oAuthToken.update({
          where: { id: refreshToken.id },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }

    // Token not found is not an error per RFC 7009
  }

  /**
   * Introspect a token
   */
  async introspectToken(token: string): Promise<{
    active: boolean;
    scope?: string;
    client_id?: string;
    exp?: number;
    iat?: number;
    sub?: string;
    aud?: string;
    iss?: string;
    token_type?: string;
    campground_id?: string;
  }> {
    const tokenHash = this.hashToken(token);

    const tokenRecord = await this.prisma.oAuthToken.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { oAuthClient: true },
    });

    if (!tokenRecord || !tokenRecord.oAuthClient || !tokenRecord.oAuthClient.isActive) {
      return { active: false };
    }

    return {
      active: true,
      scope: scopesToString(tokenRecord.scopes || []),
      client_id: tokenRecord.oAuthClient.clientId,
      exp: Math.floor(tokenRecord.expiresAt.getTime() / 1000),
      iat: Math.floor(tokenRecord.createdAt.getTime() / 1000),
      sub: tokenRecord.userId || tokenRecord.oAuthClientId,
      aud: tokenRecord.oAuthClient.clientId,
      iss: this.issuer,
      token_type: "Bearer",
      campground_id: tokenRecord.oAuthClient.campgroundId,
    };
  }

  /**
   * Validate an access token and return token info
   */
  async validateAccessToken(token: string): Promise<{
    valid: boolean;
    clientId?: string;
    campgroundId?: string;
    scopes?: string[];
    userId?: string;
    tokenId?: string;
  }> {
    const tokenHash = this.hashToken(token);

    const tokenRecord = await this.prisma.oAuthToken.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { oAuthClient: true },
    });

    if (!tokenRecord || !tokenRecord.oAuthClient || !tokenRecord.oAuthClient.isActive) {
      return { valid: false };
    }

    return {
      valid: true,
      clientId: tokenRecord.oAuthClient.clientId,
      campgroundId: tokenRecord.oAuthClient.campgroundId,
      scopes: tokenRecord.scopes || [],
      userId: tokenRecord.userId || undefined,
      tokenId: tokenRecord.id,
    };
  }

  /**
   * Register a new OAuth client
   */
  async registerClient(opts: {
    campgroundId: string;
    name: string;
    redirectUris: string[];
    scopes?: string[];
    grantTypes?: OAuth2GrantType[];
    isConfidential?: boolean;
  }): Promise<{ client: any; clientSecret?: string }> {
    const clientId = `cs_${randomBytes(12).toString("hex")}`;
    const clientSecret = randomBytes(32).toString("hex");
    const hashedSecret = await bcrypt.hash(clientSecret, 12);

    const scopes = opts.scopes && opts.scopes.length > 0
      ? opts.scopes
      : DEFAULT_API_SCOPES.map(s => s as string);

    const grantTypes = opts.grantTypes || [OAuth2GrantType.CLIENT_CREDENTIALS];
    const isConfidential = opts.isConfidential ?? true;

    const client = await this.prisma.oAuthClient.create({
      data: {
        campgroundId: opts.campgroundId,
        name: opts.name,
        clientId,
        clientSecretHash: hashedSecret,
        redirectUris: opts.redirectUris,
        scopes,
        grantTypes: grantTypes.map(g => g as string),
        isConfidential,
        isActive: true,
      },
    });

    return {
      client,
      clientSecret: isConfidential ? clientSecret : undefined,
    };
  }

  /**
   * Rotate client secret
   */
  async rotateClientSecret(clientDbId: string): Promise<{ clientSecret: string }> {
    const clientSecret = randomBytes(32).toString("hex");
    const hashedSecret = await bcrypt.hash(clientSecret, 12);

    await this.prisma.oAuthClient.update({
      where: { id: clientDbId },
      data: { clientSecretHash: hashedSecret },
    });

    // Revoke all existing tokens for this client
    await this.prisma.oAuthToken.updateMany({
      where: { oAuthClientId: clientDbId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { clientSecret };
  }

  // Private helper methods

  private async validateClient(clientId: string, clientSecret: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client || !client.isActive) {
      this.throwOAuth2Error("invalid_client", "Invalid client");
    }

    if (client.isConfidential) {
      const match = await bcrypt.compare(clientSecret, client.clientSecretHash || "");
      if (!match) {
        this.throwOAuth2Error("invalid_client", "Invalid client credentials");
      }
    }

    return client;
  }

  private async generateTokens(
    clientDbId: string,
    campgroundId: string,
    scopes: string[],
    userId?: string
  ): Promise<TokenGenerationResult> {
    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(48).toString("hex");

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
      scope: scopes,
    };
  }

  private async persistToken(
    clientDbId: string,
    tokens: TokenGenerationResult,
    scopes: string[],
    userId?: string
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.accessTokenTtl * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtl * 1000);

    await this.prisma.oAuthToken.create({
      data: {
        oAuthClientId: clientDbId,
        accessTokenHash: this.hashToken(tokens.accessToken),
        refreshTokenHash: tokens.refreshToken ? this.hashToken(tokens.refreshToken) : null,
        scopes,
        userId,
        expiresAt,
        refreshExpiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private cleanupAuthCodes(): void {
    const now = Date.now();
    for (const [code, entry] of this.authCodes.entries()) {
      if (entry.expiresAt < now) {
        this.authCodes.delete(code);
      }
    }
  }

  private throwOAuth2Error(error: OAuth2ErrorCode, description: string): never {
    switch (error) {
      case "invalid_client":
      case "invalid_token":
      case "access_denied":
        throw new UnauthorizedException({ error, error_description: description });
      case "invalid_request":
      case "invalid_scope":
      case "unsupported_grant_type":
      case "unsupported_response_type":
        throw new BadRequestException({ error, error_description: description });
      case "invalid_grant":
        throw new BadRequestException({ error, error_description: description });
      default:
        throw new BadRequestException({ error, error_description: description });
    }
  }
}
