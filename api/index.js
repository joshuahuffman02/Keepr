"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod,
  )
);
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/auth/oauth2/index.ts
var index_exports = {};
__export(index_exports, {
  ALL_SCOPES: () => ALL_SCOPES,
  DEFAULT_API_SCOPES: () => DEFAULT_API_SCOPES,
  OAuth2AuthorizeRequestDto: () => OAuth2AuthorizeRequestDto,
  OAuth2ClientRegistrationDto: () => OAuth2ClientRegistrationDto,
  OAuth2Controller: () => OAuth2Controller,
  OAuth2GrantType: () => OAuth2GrantType,
  OAuth2IntrospectRequestDto: () => OAuth2IntrospectRequestDto,
  OAuth2Module: () => OAuth2Module,
  OAuth2ResponseType: () => OAuth2ResponseType,
  OAuth2RevokeRequestDto: () => OAuth2RevokeRequestDto,
  OAuth2Scope: () => OAuth2Scope,
  OAuth2Service: () => OAuth2Service,
  OAuth2TokenRequestDto: () => OAuth2TokenRequestDto,
  generateCodeChallenge: () => generateCodeChallenge,
  generateCodeVerifier: () => generateCodeVerifier,
  parseScopes: () => parseScopes,
  scopesToString: () => scopesToString,
  validateScopes: () => validateScopes,
  verifyCodeChallenge: () => verifyCodeChallenge,
});
module.exports = __toCommonJS(index_exports);

// src/auth/oauth2/oauth2.module.ts
var import_common7 = require("@nestjs/common");
var import_jwt2 = require("@nestjs/jwt");
var import_config2 = require("@nestjs/config");

// src/auth/oauth2/oauth2.controller.ts
var import_common5 = require("@nestjs/common");
var import_express = require("express");
var import_swagger2 = require("@nestjs/swagger");

// src/auth/oauth2/oauth2.service.ts
var import_common2 = require("@nestjs/common");
var import_jwt = require("@nestjs/jwt");
var import_config = require("@nestjs/config");

// src/prisma/prisma.service.ts
var import_common = require("@nestjs/common");
var import_client = require("@prisma/client");
var import_adapter_pg = require("@prisma/adapter-pg");
function _ts_decorate(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate, "_ts_decorate");
function _ts_metadata(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
}
__name(_ts_metadata, "_ts_metadata");
var PrismaService = class _PrismaService extends import_client.PrismaClient {
  static {
    __name(this, "PrismaService");
  }
  logger = new import_common.Logger(_PrismaService.name);
  constructor() {
    const connectionString = process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL;
    if (!connectionString) {
      throw new import_common.InternalServerErrorException(
        "DATABASE_URL or PLATFORM_DATABASE_URL must be set",
      );
    }
    const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || "10", 10);
    const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT || "30", 10);
    const adapter = new import_adapter_pg.PrismaPg({
      connectionString,
      max: poolSize,
      idleTimeout: poolTimeout,
      connectionTimeout: 10,
    });
    super({
      adapter,
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async enableShutdownHooks(app) {
    process.on("beforeExit", async () => {
      await app.close();
    });
  }
};
PrismaService = _ts_decorate(
  [
    (0, import_common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
  ],
  PrismaService,
);

// src/auth/oauth2/oauth2.service.ts
var import_crypto = require("crypto");
var bcrypt = __toESM(require("bcryptjs"));

// src/auth/oauth2/oauth2.types.ts
var OAuth2GrantType = /* @__PURE__ */ (function (OAuth2GrantType2) {
  OAuth2GrantType2["CLIENT_CREDENTIALS"] = "client_credentials";
  OAuth2GrantType2["AUTHORIZATION_CODE"] = "authorization_code";
  OAuth2GrantType2["REFRESH_TOKEN"] = "refresh_token";
  return OAuth2GrantType2;
})({});
var OAuth2ResponseType = /* @__PURE__ */ (function (OAuth2ResponseType2) {
  OAuth2ResponseType2["CODE"] = "code";
  OAuth2ResponseType2["TOKEN"] = "token";
  return OAuth2ResponseType2;
})({});
var OAuth2Scope = /* @__PURE__ */ (function (OAuth2Scope2) {
  OAuth2Scope2["RESERVATIONS_READ"] = "reservations:read";
  OAuth2Scope2["RESERVATIONS_WRITE"] = "reservations:write";
  OAuth2Scope2["GUESTS_READ"] = "guests:read";
  OAuth2Scope2["GUESTS_WRITE"] = "guests:write";
  OAuth2Scope2["SITES_READ"] = "sites:read";
  OAuth2Scope2["SITES_WRITE"] = "sites:write";
  OAuth2Scope2["WEBHOOKS_READ"] = "webhooks:read";
  OAuth2Scope2["WEBHOOKS_WRITE"] = "webhooks:write";
  OAuth2Scope2["TOKENS_READ"] = "tokens:read";
  OAuth2Scope2["TOKENS_WRITE"] = "tokens:write";
  OAuth2Scope2["OFFLINE_ACCESS"] = "offline_access";
  OAuth2Scope2["OPENID"] = "openid";
  OAuth2Scope2["PROFILE"] = "profile";
  return OAuth2Scope2;
})({});
var ALL_SCOPES = Object.values(OAuth2Scope);
var DEFAULT_API_SCOPES = [
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
];
function generateCodeVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const crypto = require("crypto");
  const randomBytes2 = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes2[i] % chars.length];
  }
  return result;
}
__name(generateCodeVerifier, "generateCodeVerifier");
function generateCodeChallenge(verifier, method = "S256") {
  if (method === "plain") {
    return verifier;
  }
  const crypto = require("crypto");
  const hash2 = crypto.createHash("sha256").update(verifier).digest();
  return hash2.toString("base64url");
}
__name(generateCodeChallenge, "generateCodeChallenge");
function verifyCodeChallenge(verifier, challenge, method = "S256") {
  const computedChallenge = generateCodeChallenge(verifier, method);
  return computedChallenge === challenge;
}
__name(verifyCodeChallenge, "verifyCodeChallenge");
function parseScopes(scopeString) {
  if (!scopeString) return [];
  return scopeString
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
}
__name(parseScopes, "parseScopes");
function scopesToString(scopes) {
  return scopes.join(" ");
}
__name(scopesToString, "scopesToString");
function validateScopes(requested, allowed) {
  const allowedSet = new Set(allowed);
  return requested.filter((scope) => allowedSet.has(scope));
}
__name(validateScopes, "validateScopes");

// src/auth/oauth2/oauth2.service.ts
function _ts_decorate2(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate2, "_ts_decorate");
function _ts_metadata2(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
}
__name(_ts_metadata2, "_ts_metadata");
var OAuth2Service = class _OAuth2Service {
  static {
    __name(this, "OAuth2Service");
  }
  prisma;
  jwtService;
  config;
  logger = new import_common2.Logger(_OAuth2Service.name);
  accessTokenTtl;
  refreshTokenTtl;
  authCodeTtl;
  issuer;
  // In-memory store for authorization codes (TODO: move to Redis for production)
  authCodes = /* @__PURE__ */ new Map();
  constructor(prisma, jwtService, config) {
    this.prisma = prisma;
    this.jwtService = jwtService;
    this.config = config;
    this.accessTokenTtl = this.config.get("OAUTH2_ACCESS_TOKEN_TTL", 3600);
    this.refreshTokenTtl = this.config.get("OAUTH2_REFRESH_TOKEN_TTL", 2592e3);
    this.authCodeTtl = this.config.get("OAUTH2_AUTH_CODE_TTL", 600);
    this.issuer = this.config.get("OAUTH2_ISSUER", "https://api.campreserv.com");
  }
  /**
   * Issue tokens using client credentials grant
   */
  async issueClientCredentialsToken(opts) {
    const client = await this.validateClient(opts.clientId, opts.clientSecret);
    const requestedScopes = parseScopes(opts.scope);
    const allowedScopes = client.scopes || DEFAULT_API_SCOPES.map((s) => s);
    const grantedScopes =
      requestedScopes.length > 0 ? validateScopes(requestedScopes, allowedScopes) : allowedScopes;
    if (grantedScopes.length === 0 && requestedScopes.length > 0) {
      this.throwOAuth2Error("invalid_scope", "None of the requested scopes are allowed");
    }
    const tokens = await this.generateTokens(client.id, client.campgroundId, grantedScopes);
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
  async generateAuthorizationCode(opts) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: {
        clientId: opts.clientId,
      },
    });
    if (!client || !client.isActive) {
      this.throwOAuth2Error("invalid_client", "Invalid client");
    }
    const redirectUris = client.redirectUris || [];
    if (!redirectUris.includes(opts.redirectUri)) {
      this.throwOAuth2Error("invalid_request", "Invalid redirect_uri");
    }
    if (!client.isConfidential && !opts.codeChallenge) {
      this.throwOAuth2Error(
        "invalid_request",
        "PKCE code_challenge is required for public clients",
      );
    }
    const code = (0, import_crypto.randomBytes)(32).toString("hex");
    const expiresAt = Date.now() + this.authCodeTtl * 1e3;
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
    this.cleanupAuthCodes();
    return code;
  }
  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthorizationCode(opts) {
    const codeEntry = this.authCodes.get(opts.code);
    if (!codeEntry || codeEntry.expiresAt < Date.now()) {
      this.authCodes.delete(opts.code);
      this.throwOAuth2Error("invalid_grant", "Invalid or expired authorization code");
    }
    const codeData = codeEntry.data;
    this.authCodes.delete(opts.code);
    if (codeData.clientId !== opts.clientId) {
      this.throwOAuth2Error("invalid_grant", "Client ID mismatch");
    }
    if (codeData.redirectUri !== opts.redirectUri) {
      this.throwOAuth2Error("invalid_grant", "Redirect URI mismatch");
    }
    const client = await this.prisma.oAuthClient.findUnique({
      where: {
        clientId: opts.clientId,
      },
    });
    if (!client || !client.isActive) {
      this.throwOAuth2Error("invalid_client", "Invalid client");
    }
    if (client.isConfidential) {
      if (!opts.clientSecret) {
        this.throwOAuth2Error("invalid_client", "Client secret required");
      }
      const secretValid = await bcrypt.compare(opts.clientSecret, client.clientSecretHash || "");
      if (!secretValid) {
        this.throwOAuth2Error("invalid_client", "Invalid client credentials");
      }
    }
    if (codeData.codeChallenge) {
      if (!opts.codeVerifier) {
        this.throwOAuth2Error("invalid_grant", "PKCE code_verifier required");
      }
      const method = codeData.codeChallengeMethod || "S256";
      if (!verifyCodeChallenge(opts.codeVerifier, codeData.codeChallenge, method)) {
        this.throwOAuth2Error("invalid_grant", "Invalid code_verifier");
      }
    }
    const tokens = await this.generateTokens(
      client.id,
      client.campgroundId,
      codeData.scope,
      codeData.userId,
    );
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
  async refreshAccessToken(refreshToken) {
    const tokenHash = this.hashToken(refreshToken);
    const token = await this.prisma.oAuthToken.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        refreshExpiresAt: {
          gt: /* @__PURE__ */ new Date(),
        },
      },
      include: {
        oAuthClient: true,
      },
    });
    if (!token || !token.oAuthClient || !token.oAuthClient.isActive) {
      this.throwOAuth2Error("invalid_grant", "Invalid refresh token");
    }
    const scopes = token.scopes || [];
    const tokens = await this.generateTokens(
      token.oAuthClientId,
      token.oAuthClient.campgroundId,
      scopes,
      token.userId || void 0,
    );
    await this.prisma.oAuthToken.update({
      where: {
        id: token.id,
      },
      data: {
        revokedAt: /* @__PURE__ */ new Date(),
      },
    });
    await this.persistToken(token.oAuthClientId, tokens, scopes, token.userId || void 0);
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
  async revokeToken(token, tokenTypeHint) {
    const tokenHash = this.hashToken(token);
    if (!tokenTypeHint || tokenTypeHint === "access_token") {
      const accessToken = await this.prisma.oAuthToken.findFirst({
        where: {
          accessTokenHash: tokenHash,
          revokedAt: null,
        },
      });
      if (accessToken) {
        await this.prisma.oAuthToken.update({
          where: {
            id: accessToken.id,
          },
          data: {
            revokedAt: /* @__PURE__ */ new Date(),
          },
        });
        return;
      }
    }
    if (!tokenTypeHint || tokenTypeHint === "refresh_token") {
      const refreshToken = await this.prisma.oAuthToken.findFirst({
        where: {
          refreshTokenHash: tokenHash,
          revokedAt: null,
        },
      });
      if (refreshToken) {
        await this.prisma.oAuthToken.update({
          where: {
            id: refreshToken.id,
          },
          data: {
            revokedAt: /* @__PURE__ */ new Date(),
          },
        });
        return;
      }
    }
  }
  /**
   * Introspect a token
   */
  async introspectToken(token) {
    const tokenHash = this.hashToken(token);
    const tokenRecord = await this.prisma.oAuthToken.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: /* @__PURE__ */ new Date(),
        },
      },
      include: {
        oAuthClient: true,
      },
    });
    if (!tokenRecord || !tokenRecord.oAuthClient || !tokenRecord.oAuthClient.isActive) {
      return {
        active: false,
      };
    }
    return {
      active: true,
      scope: scopesToString(tokenRecord.scopes || []),
      client_id: tokenRecord.oAuthClient.clientId,
      exp: Math.floor(tokenRecord.expiresAt.getTime() / 1e3),
      iat: Math.floor(tokenRecord.createdAt.getTime() / 1e3),
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
  async validateAccessToken(token) {
    const tokenHash = this.hashToken(token);
    const tokenRecord = await this.prisma.oAuthToken.findFirst({
      where: {
        accessTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: /* @__PURE__ */ new Date(),
        },
      },
      include: {
        oAuthClient: true,
      },
    });
    if (!tokenRecord || !tokenRecord.oAuthClient || !tokenRecord.oAuthClient.isActive) {
      return {
        valid: false,
      };
    }
    return {
      valid: true,
      clientId: tokenRecord.oAuthClient.clientId,
      campgroundId: tokenRecord.oAuthClient.campgroundId,
      scopes: tokenRecord.scopes || [],
      userId: tokenRecord.userId || void 0,
      tokenId: tokenRecord.id,
    };
  }
  /**
   * Register a new OAuth client
   */
  async registerClient(opts) {
    const clientId = `cs_${(0, import_crypto.randomBytes)(12).toString("hex")}`;
    const clientSecret = (0, import_crypto.randomBytes)(32).toString("hex");
    const hashedSecret = await bcrypt.hash(clientSecret, 12);
    const scopes =
      opts.scopes && opts.scopes.length > 0 ? opts.scopes : DEFAULT_API_SCOPES.map((s) => s);
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
        grantTypes: grantTypes.map((g) => g),
        isConfidential,
        isActive: true,
      },
    });
    return {
      client,
      clientSecret: isConfidential ? clientSecret : void 0,
    };
  }
  /**
   * Rotate client secret
   */
  async rotateClientSecret(clientDbId) {
    const clientSecret = (0, import_crypto.randomBytes)(32).toString("hex");
    const hashedSecret = await bcrypt.hash(clientSecret, 12);
    await this.prisma.oAuthClient.update({
      where: {
        id: clientDbId,
      },
      data: {
        clientSecretHash: hashedSecret,
      },
    });
    await this.prisma.oAuthToken.updateMany({
      where: {
        oAuthClientId: clientDbId,
        revokedAt: null,
      },
      data: {
        revokedAt: /* @__PURE__ */ new Date(),
      },
    });
    return {
      clientSecret,
    };
  }
  // Private helper methods
  async validateClient(clientId, clientSecret) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: {
        clientId,
      },
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
  async generateTokens(clientDbId, campgroundId, scopes, userId) {
    const accessToken = (0, import_crypto.randomBytes)(32).toString("hex");
    const refreshToken = (0, import_crypto.randomBytes)(48).toString("hex");
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
      scope: scopes,
    };
  }
  async persistToken(clientDbId, tokens, scopes, userId) {
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + this.accessTokenTtl * 1e3);
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtl * 1e3);
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
  hashToken(token) {
    return (0, import_crypto.createHash)("sha256").update(token).digest("hex");
  }
  cleanupAuthCodes() {
    const now = Date.now();
    for (const [code, entry] of this.authCodes.entries()) {
      if (entry.expiresAt < now) {
        this.authCodes.delete(code);
      }
    }
  }
  throwOAuth2Error(error, description) {
    switch (error) {
      case "invalid_client":
      case "invalid_token":
      case "access_denied":
        throw new import_common2.UnauthorizedException({
          error,
          error_description: description,
        });
      case "invalid_request":
      case "invalid_scope":
      case "unsupported_grant_type":
      case "unsupported_response_type":
        throw new import_common2.BadRequestException({
          error,
          error_description: description,
        });
      case "invalid_grant":
        throw new import_common2.BadRequestException({
          error,
          error_description: description,
        });
      default:
        throw new import_common2.BadRequestException({
          error,
          error_description: description,
        });
    }
  }
};
OAuth2Service = _ts_decorate2(
  [
    (0, import_common2.Injectable)(),
    _ts_metadata2("design:type", Function),
    _ts_metadata2("design:paramtypes", [
      typeof PrismaService === "undefined" ? Object : PrismaService,
      typeof import_jwt.JwtService === "undefined" ? Object : import_jwt.JwtService,
      typeof import_config.ConfigService === "undefined" ? Object : import_config.ConfigService,
    ]),
  ],
  OAuth2Service,
);

// src/auth/oauth2/dto/oauth2.dto.ts
var import_class_validator = require("class-validator");
var import_swagger = require("@nestjs/swagger");
function _ts_decorate3(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate3, "_ts_decorate");
function _ts_metadata3(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
}
__name(_ts_metadata3, "_ts_metadata");
var OAuth2TokenRequestDto = class {
  static {
    __name(this, "OAuth2TokenRequestDto");
  }
  grant_type;
  client_id;
  client_secret;
  scope;
  refresh_token;
  code;
  redirect_uri;
  code_verifier;
};
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      enum: [
        OAuth2GrantType.CLIENT_CREDENTIALS,
        OAuth2GrantType.AUTHORIZATION_CODE,
        OAuth2GrantType.REFRESH_TOKEN,
      ],
      description: "OAuth2 grant type",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsIn)([
      OAuth2GrantType.CLIENT_CREDENTIALS,
      OAuth2GrantType.AUTHORIZATION_CODE,
      OAuth2GrantType.REFRESH_TOKEN,
    ]),
    _ts_metadata3("design:type", typeof OAuth2GrantType === "undefined" ? Object : OAuth2GrantType),
  ],
  OAuth2TokenRequestDto.prototype,
  "grant_type",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Client ID for client_credentials or authorization_code grant",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "client_id",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Client secret for confidential clients",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "client_secret",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Space-separated list of requested scopes",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "scope",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Refresh token for refresh_token grant",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "refresh_token",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Authorization code for authorization_code grant",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "code",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Redirect URI (must match the one used in authorization request)",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "redirect_uri",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "PKCE code verifier",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2TokenRequestDto.prototype,
  "code_verifier",
  void 0,
);
var OAuth2AuthorizeRequestDto = class {
  static {
    __name(this, "OAuth2AuthorizeRequestDto");
  }
  client_id;
  response_type;
  redirect_uri;
  scope;
  state;
  code_challenge;
  code_challenge_method;
  nonce;
};
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Client ID",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsNotEmpty)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "client_id",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      enum: [OAuth2ResponseType.CODE, OAuth2ResponseType.TOKEN],
      description: "Response type",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsIn)([OAuth2ResponseType.CODE, OAuth2ResponseType.TOKEN]),
    _ts_metadata3(
      "design:type",
      typeof OAuth2ResponseType === "undefined" ? Object : OAuth2ResponseType,
    ),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "response_type",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Redirect URI (must be registered with the client)",
    }),
    (0, import_class_validator.IsUrl)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "redirect_uri",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Space-separated list of requested scopes",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "scope",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "State parameter for CSRF protection",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "state",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "PKCE code challenge",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    (0, import_class_validator.Matches)(/^[A-Za-z0-9_-]+$/, {
      message: "Invalid code_challenge format",
    }),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "code_challenge",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      enum: ["S256", "plain"],
      description: "PKCE code challenge method",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    (0, import_class_validator.IsIn)(["S256", "plain"]),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "code_challenge_method",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Nonce for OpenID Connect",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2AuthorizeRequestDto.prototype,
  "nonce",
  void 0,
);
var OAuth2RevokeRequestDto = class {
  static {
    __name(this, "OAuth2RevokeRequestDto");
  }
  token;
  token_type_hint;
};
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Token to revoke (access_token or refresh_token)",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsNotEmpty)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2RevokeRequestDto.prototype,
  "token",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      enum: ["access_token", "refresh_token"],
      description: "Type of token being revoked",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    (0, import_class_validator.IsIn)(["access_token", "refresh_token"]),
    _ts_metadata3("design:type", String),
  ],
  OAuth2RevokeRequestDto.prototype,
  "token_type_hint",
  void 0,
);
var OAuth2IntrospectRequestDto = class {
  static {
    __name(this, "OAuth2IntrospectRequestDto");
  }
  token;
  token_type_hint;
};
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Token to introspect",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsNotEmpty)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2IntrospectRequestDto.prototype,
  "token",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      enum: ["access_token", "refresh_token"],
      description: "Type of token being introspected",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsOptional)(),
    (0, import_class_validator.IsIn)(["access_token", "refresh_token"]),
    _ts_metadata3("design:type", String),
  ],
  OAuth2IntrospectRequestDto.prototype,
  "token_type_hint",
  void 0,
);
var OAuth2ClientRegistrationDto = class {
  static {
    __name(this, "OAuth2ClientRegistrationDto");
  }
  name;
  redirect_uris;
  scopes;
  grant_types;
  is_confidential;
};
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Client application name",
    }),
    (0, import_class_validator.IsString)(),
    (0, import_class_validator.IsNotEmpty)(),
    _ts_metadata3("design:type", String),
  ],
  OAuth2ClientRegistrationDto.prototype,
  "name",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiProperty)({
      description: "Redirect URIs",
      type: [String],
    }),
    (0, import_class_validator.IsUrl)(
      {},
      {
        each: true,
      },
    ),
    _ts_metadata3("design:type", Array),
  ],
  OAuth2ClientRegistrationDto.prototype,
  "redirect_uris",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Allowed scopes",
      type: [String],
    }),
    (0, import_class_validator.IsString)({
      each: true,
    }),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", Array),
  ],
  OAuth2ClientRegistrationDto.prototype,
  "scopes",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Allowed grant types",
      type: [String],
      enum: Object.values(OAuth2GrantType),
    }),
    (0, import_class_validator.IsString)({
      each: true,
    }),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", Array),
  ],
  OAuth2ClientRegistrationDto.prototype,
  "grant_types",
  void 0,
);
_ts_decorate3(
  [
    (0, import_swagger.ApiPropertyOptional)({
      description: "Is this a confidential client (server app)?",
    }),
    (0, import_class_validator.IsOptional)(),
    _ts_metadata3("design:type", Boolean),
  ],
  OAuth2ClientRegistrationDto.prototype,
  "is_confidential",
  void 0,
);

// src/auth/guards/jwt-auth.guard.ts
var import_common3 = require("@nestjs/common");
var import_passport = require("@nestjs/passport");
function _ts_decorate4(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate4, "_ts_decorate");
var JwtAuthGuard = class extends (0, import_passport.AuthGuard)("jwt") {
  static {
    __name(this, "JwtAuthGuard");
  }
  canActivate(context) {
    return super.canActivate(context);
  }
};
JwtAuthGuard = _ts_decorate4([(0, import_common3.Injectable)()], JwtAuthGuard);

// src/auth/decorators/current-user.decorator.ts
var import_common4 = require("@nestjs/common");
var CurrentUser = (0, import_common4.createParamDecorator)((_, ctx) => {
  const request = ctx.switchToHttp().getRequest();
  return request?.user ?? null;
});

// src/auth/oauth2/oauth2.controller.ts
function _ts_decorate5(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate5, "_ts_decorate");
function _ts_metadata4(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
}
__name(_ts_metadata4, "_ts_metadata");
function _ts_param(paramIndex, decorator) {
  return function (target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param, "_ts_param");
var OAuth2Controller = class _OAuth2Controller {
  static {
    __name(this, "OAuth2Controller");
  }
  oauth2Service;
  logger = new (require("@nestjs/common").Logger)(_OAuth2Controller.name);
  constructor(oauth2Service) {
    this.oauth2Service = oauth2Service;
  }
  /**
   * Token endpoint - Exchange credentials for tokens
   */
  async token(body) {
    switch (body.grant_type) {
      case OAuth2GrantType.CLIENT_CREDENTIALS:
        if (!body.client_id || !body.client_secret) {
          throw new import_common5.BadRequestException({
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
          throw new import_common5.BadRequestException({
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
          throw new import_common5.BadRequestException({
            error: "invalid_request",
            error_description: "refresh_token is required",
          });
        }
        return this.oauth2Service.refreshAccessToken(body.refresh_token);
      default:
        throw new import_common5.BadRequestException({
          error: "unsupported_grant_type",
          error_description: `Grant type "${body.grant_type}" is not supported`,
        });
    }
  }
  /**
   * Authorization endpoint - Initiate authorization code flow
   */
  async authorize(query, user, res) {
    if (query.response_type !== OAuth2ResponseType.CODE) {
      return this.redirectWithError(
        res,
        query.redirect_uri,
        "unsupported_response_type",
        "Only 'code' response type is supported",
        query.state,
      );
    }
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
    } catch (error) {
      const errorCode = error.response?.error || "server_error";
      const errorDesc = error.response?.error_description || error.message;
      return this.redirectWithError(res, query.redirect_uri, errorCode, errorDesc, query.state);
    }
  }
  /**
   * Token revocation endpoint
   */
  async revoke(body) {
    await this.oauth2Service.revokeToken(body.token, body.token_type_hint);
    return {};
  }
  /**
   * Token introspection endpoint
   */
  async introspect(body) {
    return this.oauth2Service.introspectToken(body.token);
  }
  /**
   * OpenID Connect discovery endpoint
   */
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
  redirectWithError(res, redirectUri, error, errorDescription, state) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set("error", error);
      url.searchParams.set("error_description", errorDescription);
      if (state) {
        url.searchParams.set("state", state);
      }
      return res.redirect(url.toString());
    } catch {
      throw new import_common5.BadRequestException({
        error,
        error_description: errorDescription,
      });
    }
  }
};
_ts_decorate5(
  [
    (0, import_common5.Post)("token"),
    (0, import_common5.HttpCode)(import_common5.HttpStatus.OK),
    (0, import_swagger2.ApiOperation)({
      summary: "Get access token",
      description:
        "Exchange client credentials, authorization code, or refresh token for an access token",
    }),
    (0, import_swagger2.ApiBody)({
      type: OAuth2TokenRequestDto,
    }),
    (0, import_swagger2.ApiResponse)({
      status: 200,
      description: "Token issued successfully",
      schema: {
        type: "object",
        properties: {
          token_type: {
            type: "string",
            example: "Bearer",
          },
          access_token: {
            type: "string",
          },
          refresh_token: {
            type: "string",
          },
          expires_in: {
            type: "number",
            example: 3600,
          },
          scope: {
            type: "string",
            example: "reservations:read guests:read",
          },
          campground_id: {
            type: "string",
          },
        },
      },
    }),
    (0, import_swagger2.ApiResponse)({
      status: 400,
      description: "Invalid request",
    }),
    (0, import_swagger2.ApiResponse)({
      status: 401,
      description: "Invalid credentials",
    }),
    _ts_param(0, (0, import_common5.Body)()),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", [
      typeof OAuth2TokenRequestDto === "undefined" ? Object : OAuth2TokenRequestDto,
    ]),
    _ts_metadata4("design:returntype", Promise),
  ],
  OAuth2Controller.prototype,
  "token",
  null,
);
_ts_decorate5(
  [
    (0, import_common5.Get)("authorize"),
    (0, import_common5.UseGuards)(JwtAuthGuard),
    (0, import_swagger2.ApiBearerAuth)("bearer"),
    (0, import_swagger2.ApiOperation)({
      summary: "Authorization endpoint",
      description: "Initiate OAuth2 authorization code flow. Requires user authentication.",
    }),
    (0, import_swagger2.ApiResponse)({
      status: 200,
      description: "Returns authorization consent page data",
    }),
    (0, import_swagger2.ApiResponse)({
      status: 302,
      description: "Redirect to login or consent",
    }),
    (0, import_swagger2.ApiResponse)({
      status: 400,
      description: "Invalid request",
    }),
    _ts_param(0, (0, import_common5.Query)()),
    _ts_param(1, CurrentUser()),
    _ts_param(2, (0, import_common5.Res)()),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", [
      typeof OAuth2AuthorizeRequestDto === "undefined" ? Object : OAuth2AuthorizeRequestDto,
      Object,
      typeof import_express.Response === "undefined" ? Object : import_express.Response,
    ]),
    _ts_metadata4("design:returntype", Promise),
  ],
  OAuth2Controller.prototype,
  "authorize",
  null,
);
_ts_decorate5(
  [
    (0, import_common5.Post)("revoke"),
    (0, import_common5.HttpCode)(import_common5.HttpStatus.OK),
    (0, import_swagger2.ApiOperation)({
      summary: "Revoke token",
      description: "Revoke an access token or refresh token",
    }),
    (0, import_swagger2.ApiBody)({
      type: OAuth2RevokeRequestDto,
    }),
    (0, import_swagger2.ApiResponse)({
      status: 200,
      description: "Token revoked (or was already invalid)",
    }),
    _ts_param(0, (0, import_common5.Body)()),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", [
      typeof OAuth2RevokeRequestDto === "undefined" ? Object : OAuth2RevokeRequestDto,
    ]),
    _ts_metadata4("design:returntype", Promise),
  ],
  OAuth2Controller.prototype,
  "revoke",
  null,
);
_ts_decorate5(
  [
    (0, import_common5.Post)("introspect"),
    (0, import_common5.HttpCode)(import_common5.HttpStatus.OK),
    (0, import_swagger2.ApiOperation)({
      summary: "Introspect token",
      description: "Get information about a token",
    }),
    (0, import_swagger2.ApiBody)({
      type: OAuth2IntrospectRequestDto,
    }),
    (0, import_swagger2.ApiResponse)({
      status: 200,
      description: "Token introspection result",
      schema: {
        type: "object",
        properties: {
          active: {
            type: "boolean",
          },
          scope: {
            type: "string",
          },
          client_id: {
            type: "string",
          },
          exp: {
            type: "number",
          },
          iat: {
            type: "number",
          },
          sub: {
            type: "string",
          },
          aud: {
            type: "string",
          },
          iss: {
            type: "string",
          },
          token_type: {
            type: "string",
          },
          campground_id: {
            type: "string",
          },
        },
      },
    }),
    _ts_param(0, (0, import_common5.Body)()),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", [
      typeof OAuth2IntrospectRequestDto === "undefined" ? Object : OAuth2IntrospectRequestDto,
    ]),
    _ts_metadata4("design:returntype", Promise),
  ],
  OAuth2Controller.prototype,
  "introspect",
  null,
);
_ts_decorate5(
  [
    (0, import_common5.Get)(".well-known/openid-configuration"),
    (0, import_swagger2.ApiOperation)({
      summary: "OpenID Connect discovery",
      description: "Returns OpenID Connect configuration metadata",
    }),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", []),
    _ts_metadata4("design:returntype", void 0),
  ],
  OAuth2Controller.prototype,
  "getOpenIdConfiguration",
  null,
);
OAuth2Controller = _ts_decorate5(
  [
    (0, import_swagger2.ApiTags)("Authentication"),
    (0, import_common5.Controller)("oauth"),
    _ts_metadata4("design:type", Function),
    _ts_metadata4("design:paramtypes", [
      typeof OAuth2Service === "undefined" ? Object : OAuth2Service,
    ]),
  ],
  OAuth2Controller,
);

// src/prisma/prisma.module.ts
var import_common6 = require("@nestjs/common");
function _ts_decorate6(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate6, "_ts_decorate");
var PrismaModule = class {
  static {
    __name(this, "PrismaModule");
  }
};
PrismaModule = _ts_decorate6(
  [
    (0, import_common6.Global)(),
    (0, import_common6.Module)({
      providers: [PrismaService],
      exports: [PrismaService],
    }),
  ],
  PrismaModule,
);

// src/auth/oauth2/oauth2.module.ts
function _ts_decorate7(decorators, target, key, desc) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return (c > 3 && r && Object.defineProperty(target, key, r), r);
}
__name(_ts_decorate7, "_ts_decorate");
var OAuth2Module = class {
  static {
    __name(this, "OAuth2Module");
  }
};
OAuth2Module = _ts_decorate7(
  [
    (0, import_common7.Module)({
      imports: [
        PrismaModule,
        import_config2.ConfigModule,
        import_jwt2.JwtModule.registerAsync({
          imports: [import_config2.ConfigModule],
          useFactory: /* @__PURE__ */ __name(
            (config) => ({
              secret: config.get("JWT_SECRET") || "dev-secret-change-me",
              signOptions: {
                expiresIn: "1h",
              },
            }),
            "useFactory",
          ),
          inject: [import_config2.ConfigService],
        }),
      ],
      controllers: [OAuth2Controller],
      providers: [OAuth2Service],
      exports: [OAuth2Service],
    }),
  ],
  OAuth2Module,
);
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    ALL_SCOPES,
    DEFAULT_API_SCOPES,
    OAuth2AuthorizeRequestDto,
    OAuth2ClientRegistrationDto,
    OAuth2Controller,
    OAuth2GrantType,
    OAuth2IntrospectRequestDto,
    OAuth2Module,
    OAuth2ResponseType,
    OAuth2RevokeRequestDto,
    OAuth2Scope,
    OAuth2Service,
    OAuth2TokenRequestDto,
    generateCodeChallenge,
    generateCodeVerifier,
    parseScopes,
    scopesToString,
    validateScopes,
    verifyCodeChallenge,
  });
