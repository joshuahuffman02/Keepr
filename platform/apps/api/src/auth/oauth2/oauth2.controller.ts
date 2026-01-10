import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { OAuth2Service } from "./oauth2.service";
import {
  OAuth2TokenRequestDto,
  OAuth2AuthorizeRequestDto,
  OAuth2RevokeRequestDto,
  OAuth2IntrospectRequestDto,
} from "./dto/oauth2.dto";
import { OAuth2GrantType, OAuth2ResponseType, parseScopes } from "./oauth2.types";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";
import type { AuthUser } from "../auth.types";

/**
 * OAuth2 Controller
 *
 * Implements OAuth2 endpoints:
 * - POST /oauth/token - Token endpoint
 * - GET /oauth/authorize - Authorization endpoint
 * - POST /oauth/authorize - Authorization consent
 * - POST /oauth/revoke - Token revocation
 * - POST /oauth/introspect - Token introspection
 */
@ApiTags("Authentication")
@Controller("oauth")
export class OAuth2Controller {
  private readonly logger = new (require("@nestjs/common").Logger)(OAuth2Controller.name);
  constructor(private readonly oauth2Service: OAuth2Service) {}

  /**
   * Token endpoint - Exchange credentials for tokens
   */
  @Post("token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get access token",
    description: "Exchange client credentials, authorization code, or refresh token for an access token",
  })
  @ApiBody({ type: OAuth2TokenRequestDto })
  @ApiResponse({
    status: 200,
    description: "Token issued successfully",
    schema: {
      type: "object",
      properties: {
        token_type: { type: "string", example: "Bearer" },
        access_token: { type: "string" },
        refresh_token: { type: "string" },
        expires_in: { type: "number", example: 3600 },
        scope: { type: "string", example: "reservations:read guests:read" },
        campground_id: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async token(@Body() body: OAuth2TokenRequestDto) {
    switch (body.grant_type) {
      case OAuth2GrantType.CLIENT_CREDENTIALS:
        if (!body.client_id || !body.client_secret) {
          throw new BadRequestException({
            error: "invalid_request",
            error_description: "client_id and client_secret are required",
          });
        }
        return this.oauth2Service.issueClientCredentialsToken({
          clientId: body.client_id,
          clientSecret: body.client_secret,
          scope: body.scope,
        });

      case OAuth2GrantType.AUTHORIZATION_CODE:
        if (!body.code || !body.client_id || !body.redirect_uri) {
          throw new BadRequestException({
            error: "invalid_request",
            error_description: "code, client_id, and redirect_uri are required",
          });
        }
        return this.oauth2Service.exchangeAuthorizationCode({
          code: body.code,
          clientId: body.client_id,
          clientSecret: body.client_secret,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier,
        });

      case OAuth2GrantType.REFRESH_TOKEN:
        if (!body.refresh_token) {
          throw new BadRequestException({
            error: "invalid_request",
            error_description: "refresh_token is required",
          });
        }
        return this.oauth2Service.refreshAccessToken(body.refresh_token);

      default:
        throw new BadRequestException({
          error: "unsupported_grant_type",
          error_description: `Grant type "${body.grant_type}" is not supported`,
        });
    }
  }

  /**
   * Authorization endpoint - Initiate authorization code flow
   * Per RFC 6749, client and redirect_uri must be validated BEFORE using redirect_uri for error responses.
   */
  @Get("authorize")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Authorization endpoint",
    description: "Initiate OAuth2 authorization code flow. Requires user authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns authorization consent page data",
  })
  @ApiResponse({ status: 302, description: "Redirect to login or consent" })
  @ApiResponse({ status: 400, description: "Invalid request" })
  async authorize(
    @Query() query: OAuth2AuthorizeRequestDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response
  ) {
    // Per RFC 6749 Section 4.1.2.1: MUST validate client_id and redirect_uri BEFORE
    // using redirect_uri for error responses. If these are invalid, return error directly.
    const validatedRedirectUri = await this.validateClientAndRedirectUri(
      query.client_id,
      query.redirect_uri
    );

    // If validation failed, validatedRedirectUri is null - return error directly, do not redirect
    if (!validatedRedirectUri) {
      throw new BadRequestException({
        error: "invalid_request",
        error_description: "Invalid client_id or redirect_uri",
      });
    }

    // Now that redirect_uri is validated, we can safely use it for error redirects
    // Validate response type
    if (query.response_type !== OAuth2ResponseType.CODE) {
      return this.redirectWithError(
        res,
        validatedRedirectUri,
        "unsupported_response_type",
        "Only 'code' response type is supported",
        query.state
      );
    }

    // For simplicity, auto-approve for now
    // In production, show consent screen
    try {
      const scopes = parseScopes(query.scope);
      const code = await this.oauth2Service.generateAuthorizationCode({
        clientId: query.client_id,
        redirectUri: validatedRedirectUri,
        scope: scopes,
        userId: user.sub,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
      });

      const redirectUrl = new URL(validatedRedirectUri);
      redirectUrl.searchParams.set("code", code);
      if (query.state) {
        redirectUrl.searchParams.set("state", query.state);
      }

      return res.redirect(redirectUrl.toString());
    } catch (error: any) {
      const errorCode = error.response?.error || "server_error";
      const errorDesc = error.response?.error_description || error.message;
      return this.redirectWithError(res, validatedRedirectUri, errorCode, errorDesc, query.state);
    }
  }

  /**
   * Validate client and redirect_uri before using redirect_uri for any response.
   * Returns the validated redirect_uri, or null if validation fails.
   */
  private async validateClientAndRedirectUri(
    clientId: string,
    redirectUri: string
  ): Promise<string | null> {
    try {
      const client = await this.oauth2Service.getClientForValidation(clientId);
      if (!client || !client.isActive) {
        this.logger.warn(`OAuth2 authorize: invalid client_id ${clientId}`);
        return null;
      }

      const registeredUris = client.redirectUris || [];
      if (!registeredUris.includes(redirectUri)) {
        this.logger.warn(`OAuth2 authorize: redirect_uri not registered for client ${clientId}`);
        return null;
      }

      return redirectUri;
    } catch (error) {
      this.logger.error(`OAuth2 authorize: error validating client/redirect_uri`, error);
      return null;
    }
  }

  /**
   * Token revocation endpoint
   * Per RFC 7009, client authentication is required.
   */
  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Revoke token",
    description: "Revoke an access token or refresh token. Client authentication is required per RFC 7009.",
  })
  @ApiBody({ type: OAuth2RevokeRequestDto })
  @ApiResponse({ status: 200, description: "Token revoked (or was already invalid)" })
  @ApiResponse({ status: 401, description: "Invalid client credentials" })
  async revoke(@Body() body: OAuth2RevokeRequestDto) {
    // Authenticate the client before processing revocation
    await this.oauth2Service.authenticateClient(body.client_id, body.client_secret);
    await this.oauth2Service.revokeToken(body.token, body.token_type_hint);
    return {}; // Empty response per RFC 7009
  }

  /**
   * Token introspection endpoint
   * Per RFC 7662, client authentication is required.
   */
  @Post("introspect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Introspect token",
    description: "Get information about a token. Client authentication is required per RFC 7662.",
  })
  @ApiBody({ type: OAuth2IntrospectRequestDto })
  @ApiResponse({
    status: 200,
    description: "Token introspection result",
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
        scope: { type: "string" },
        client_id: { type: "string" },
        exp: { type: "number" },
        iat: { type: "number" },
        sub: { type: "string" },
        aud: { type: "string" },
        iss: { type: "string" },
        token_type: { type: "string" },
        campground_id: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid client credentials" })
  async introspect(@Body() body: OAuth2IntrospectRequestDto) {
    // Authenticate the client before processing introspection
    await this.oauth2Service.authenticateClient(body.client_id, body.client_secret);
    return this.oauth2Service.introspectToken(body.token);
  }

  /**
   * OpenID Connect discovery endpoint
   */
  @Get(".well-known/openid-configuration")
  @ApiOperation({
    summary: "OpenID Connect discovery",
    description: "Returns OpenID Connect configuration metadata",
  })
  getOpenIdConfiguration() {
    const baseUrl = process.env.API_BASE_URL || "https://api.campreserv.com";
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
      introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
      jwks_uri: `${baseUrl}/api/oauth/.well-known/jwks.json`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      scopes_supported: [
        "openid",
        "profile",
        "offline_access",
        "reservations:read",
        "reservations:write",
        "guests:read",
        "guests:write",
        "sites:read",
        "sites:write",
        "webhooks:read",
        "webhooks:write",
        "tokens:read",
        "tokens:write",
      ],
      code_challenge_methods_supported: ["S256", "plain"],
      subject_types_supported: ["public"],
    };
  }

  private redirectWithError(
    res: Response,
    redirectUri: string,
    error: string,
    errorDescription: string,
    state?: string
  ) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set("error", error);
      url.searchParams.set("error_description", errorDescription);
      if (state) {
        url.searchParams.set("state", state);
      }
      return res.redirect(url.toString());
    } catch {
      throw new BadRequestException({
        error,
        error_description: errorDescription,
      });
    }
  }
}
