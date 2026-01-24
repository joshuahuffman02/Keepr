import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { createHash } from "crypto";
import { ApiPrincipal } from "../types";
import type { Request } from "express";

type ApiTokenRequest = Request & { apiPrincipal?: ApiPrincipal; campgroundId?: string };

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiTokenRequest>();
    const authHeader = request.headers["authorization"];
    const authHeaderValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!authHeaderValue || !authHeaderValue.toLowerCase().startsWith("bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeaderValue.split(" ")[1];
    if (!token) throw new UnauthorizedException("Missing bearer token");

    const hashed = this.hashToken(token);
    const record = await this.prisma.apiToken.findFirst({
      where: {
        accessTokenHash: hashed,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ApiClient: { isActive: true },
      },
      include: { ApiClient: true },
    });

    if (!record || !record.ApiClient) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const principal: ApiPrincipal = {
      apiClientId: record.apiClientId,
      tokenId: record.id,
      campgroundId: record.ApiClient.campgroundId,
      scopes: record.scopes || [],
    };

    request.apiPrincipal = principal;
    request.campgroundId = principal.campgroundId;

    return true;
  }
}
