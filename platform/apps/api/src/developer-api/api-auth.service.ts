import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiScope, ApiClientTier, TIER_LIMITS, DEFAULT_TIER_SCOPES } from "./types";
import { randomBytes, createHash, randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";

const DEFAULT_SCOPES: ApiScope[] = [
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

@Injectable()
export class ApiAuthService {
  private readonly logger = new Logger(ApiAuthService.name);
  private accessTtlSeconds = 3600;

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private pickScopes(requested: string | undefined, allowed: string[]): string[] {
    if (!requested) return allowed;
    const requestedList = requested
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowedSet = new Set(allowed);
    const filtered = requestedList.filter((scope) => allowedSet.has(scope));
    return filtered.length ? filtered : allowed;
  }

  private async validateClient(clientId: string, clientSecret: string) {
    const client = await this.prisma.apiClient.findUnique({ where: { clientId } });
    if (!client || !client.isActive) throw new UnauthorizedException("Invalid client");
    const match = await bcrypt.compare(clientSecret, client.clientSecretHash);
    if (!match) throw new UnauthorizedException("Invalid client");
    return client;
  }

  private async persistToken(apiClientId: string, scopes: string[]) {
    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(48).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.accessTtlSeconds * 1000);

    await this.prisma.apiToken.create({
      data: {
        id: randomUUID(),
        apiClientId,
        accessTokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        scopes,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async issueClientCredentialsToken(opts: {
    clientId: string;
    clientSecret: string;
    scope?: string;
  }) {
    const client = await this.validateClient(opts.clientId, opts.clientSecret);
    const scopes = this.pickScopes(opts.scope, client.scopes || []);
    const tokens = await this.persistToken(client.id, scopes);

    return {
      token_type: "Bearer",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: this.accessTtlSeconds,
      scope: scopes.join(" "),
      campground_id: client.campgroundId,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const token = await this.prisma.apiToken.findFirst({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      include: { ApiClient: true },
    });
    if (!token || !token.ApiClient || !token.ApiClient.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const scopes = token.scopes || token.ApiClient.scopes || [];
    const tokens = await this.persistToken(token.apiClientId, scopes);

    return {
      token_type: "Bearer",
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: this.accessTtlSeconds,
      scope: scopes.join(" "),
      campground_id: token.ApiClient.campgroundId,
    };
  }

  async createClient(input: {
    campgroundId: string;
    name: string;
    scopes?: ApiScope[];
    tier?: ApiClientTier;
  }) {
    const clientId = `cg_${randomBytes(6).toString("hex")}`;
    const clientSecret = randomBytes(24).toString("hex");
    const hashedSecret = await bcrypt.hash(clientSecret, 12);

    // Determine tier and scopes
    const tier = input.tier || ApiClientTier.FREE;
    const tierLimits = TIER_LIMITS[tier];
    const allowedTierScopes = DEFAULT_TIER_SCOPES[tier];

    // Use provided scopes if valid for tier, otherwise use tier defaults
    let scopes: ApiScope[];
    if (input.scopes && input.scopes.length) {
      // Filter scopes to only those allowed for the tier
      const allowedSet = new Set(allowedTierScopes);
      scopes = input.scopes.filter((s) => allowedSet.has(s));
      if (scopes.length === 0) {
        scopes = allowedTierScopes;
      }
    } else {
      scopes = allowedTierScopes;
    }

    const client = await this.prisma.apiClient.create({
      data: {
        id: randomUUID(),
        campgroundId: input.campgroundId,
        name: input.name,
        clientId,
        clientSecretHash: hashedSecret,
        scopes,
        tier,
        rateLimit: tierLimits.requestsPerHour,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Created API client ${clientId} for campground ${input.campgroundId} with tier ${tier}`,
    );

    return { client, clientSecret };
  }

  private async requireClient(campgroundId: string, clientId: string) {
    const client = await this.prisma.apiClient.findFirst({
      where: { id: clientId, campgroundId },
    });
    if (!client) {
      throw new NotFoundException("API client not found");
    }
    return client;
  }

  /**
   * Update client tier and associated limits
   */
  async updateClientTier(campgroundId: string, clientId: string, tier: ApiClientTier) {
    const tierLimits = TIER_LIMITS[tier];

    await this.requireClient(campgroundId, clientId);
    const client = await this.prisma.apiClient.update({
      where: { id: clientId },
      data: {
        tier,
        rateLimit: tierLimits.requestsPerHour,
        // Optionally update scopes to tier defaults (or leave existing)
      },
    });

    this.logger.log(`Updated API client ${client.clientId} to tier ${tier}`);
    return client;
  }

  /**
   * Get client tier limits
   */
  getClientTierLimits(tier: ApiClientTier) {
    return TIER_LIMITS[tier];
  }

  /**
   * Get available scopes for a tier
   */
  getTierScopes(tier: ApiClientTier): ApiScope[] {
    return DEFAULT_TIER_SCOPES[tier];
  }

  async listClients(campgroundId: string) {
    return this.prisma.apiClient.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  async rotateSecret(campgroundId: string, clientId: string) {
    const secret = randomBytes(24).toString("hex");
    const hashedSecret = await bcrypt.hash(secret, 12);
    await this.requireClient(campgroundId, clientId);
    const client = await this.prisma.apiClient.update({
      where: { id: clientId },
      data: { clientSecretHash: hashedSecret },
    });
    return { client, clientSecret: secret };
  }

  async setClientActive(campgroundId: string, clientId: string, isActive: boolean) {
    await this.requireClient(campgroundId, clientId);
    return this.prisma.apiClient.update({
      where: { id: clientId },
      data: { isActive },
    });
  }

  async revokeToken(campgroundId: string, tokenId: string) {
    const token = await this.prisma.apiToken.findFirst({
      where: { id: tokenId, ApiClient: { campgroundId } },
      select: { id: true },
    });
    if (!token) {
      throw new NotFoundException("API token not found");
    }
    return this.prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  async deleteClient(campgroundId: string, clientId: string) {
    await this.requireClient(campgroundId, clientId);
    await this.prisma.apiToken.deleteMany({ where: { apiClientId: clientId } });
    return this.prisma.apiClient.delete({ where: { id: clientId } });
  }

  getDefaultScopes(): ApiScope[] {
    return DEFAULT_SCOPES;
  }
}
