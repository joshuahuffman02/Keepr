import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_SCOPES_KEY } from "../decorators/api-scopes.decorator";
import { ApiPrincipal } from "../types";
import type { Request } from "express";

type ApiScopeRequest = Request & { apiPrincipal?: ApiPrincipal };

@Injectable()
export class ApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(API_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!required.length) return true;

    const request = context.switchToHttp().getRequest<ApiScopeRequest>();
    const principal: ApiPrincipal | undefined = request.apiPrincipal;
    if (!principal) throw new ForbiddenException("Missing token context");

    const allowed = required.every((scope) => principal.scopes.includes(scope));
    if (!allowed) throw new ForbiddenException("Insufficient scope");
    return true;
  }
}
