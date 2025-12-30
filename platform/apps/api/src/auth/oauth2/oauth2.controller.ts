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
    @CurrentUser() user: any,
    @Res() res: Response
  ) {
    // Validate response type
    if (query.response_type !== OAuth2ResponseType.CODE) {
      return this.redirectWithError(
        res,
        query.redirect_uri,
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
        redirectUri: query.redirect_uri,
        scope: scopes,
        userId: user.sub,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
      });

      const redirectUrl = new URL(query.redirect_uri);
      redirectUrl.searchParams.set("code", code);
      if (query.state) {
        redirectUrl.searchParams.set("state", query.state);
      }

      return res.redirect(redirectUrl.toString());
    } catch (error: any) {
      const errorCode = error.response?.error || "server_error";
      const errorDesc = error.response?.error_description || error.message;
      return this.redirectWithError(res, query.redirect_uri, errorCode, errorDesc, query.state);
    }
  }

  /**
   * Token revocation endpoint
   */
  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Revoke token",
    description: "Revoke an access token or refresh token",
  })
  @ApiBody({ type: OAuth2RevokeRequestDto })
  @ApiResponse({ status: 200, description: "Token revoked (or was already invalid)" })
  async revoke(@Body() body: OAuth2RevokeRequestDto) {
    await this.oauth2Service.revokeToken(body.token, body.token_type_hint);
    return {}; // Empty response per RFC 7009
  }

  /**
   * Token introspection endpoint
   */
  @Post("introspect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Introspect token",
    description: "Get information about a token",
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
  async introspect(@Body() body: OAuth2IntrospectRequestDto) {
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
