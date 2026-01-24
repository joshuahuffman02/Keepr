import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { RateLimitService } from "./rate-limit.service";
import { PerfService } from "./perf.service";
import { extractClientIpFromRequest } from "../common/ip-utils";

type RateLimitRequest = Request & { organizationId?: string };

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly perfService: PerfService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RateLimitRequest>();

    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const ip = extractClientIpFromRequest(req);
    const orgHeader = req.organizationId ?? req.headers["x-organization-id"];
    const orgId = Array.isArray(orgHeader) ? orgHeader[0] : (orgHeader ?? null);

    const result = this.rateLimitService.shouldAllow(ip, orgId);
    if (!result.allowed) {
      this.perfService.recordLimiterHit(result.reason);
      throw new HttpException("Too Many Requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    return next.handle();
  }
}
