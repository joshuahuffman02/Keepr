import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitTiersService } from "./rate-limit-tiers.service";
import { ApiPrincipal } from "../developer-api/types";

export const SKIP_RATE_LIMIT = "skipRateLimit";

/**
 * Decorator to skip rate limiting on specific endpoints
 */
export function SkipRateLimit() {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(SKIP_RATE_LIMIT, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(SKIP_RATE_LIMIT, true, target);
    return target;
  };
}

/**
 * Rate Limit Guard
 *
 * Applies tier-based rate limiting to API requests.
 * Works with ApiTokenGuard to get the API client context.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitTiersService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting is skipped for this endpoint
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT,
      [context.getHandler(), context.getClass()]
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get API principal from request (set by ApiTokenGuard)
    const principal: ApiPrincipal | undefined = request.apiPrincipal;

    if (!principal?.apiClientId) {
      // No API client context, skip rate limiting (handled by auth)
      return true;
    }

    // Check concurrent request limit
    const concurrentAllowed = await this.rateLimitService.startConcurrent(
      principal.apiClientId
    );

    if (!concurrentAllowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message: "Too many concurrent requests. Please wait and try again.",
          code: "CONCURRENT_LIMIT_EXCEEDED",
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Track concurrent request end on response finish
    response.on("finish", () => {
      this.rateLimitService.endConcurrent(principal.apiClientId);
    });

    // Check rate limit
    const result = await this.rateLimitService.checkLimit(principal.apiClientId);

    // Set rate limit headers
    const headers = this.rateLimitService.getRateLimitHeaders(result);
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }

    if (!result.allowed) {
      // End concurrent tracking since request is rejected
      this.rateLimitService.endConcurrent(principal.apiClientId);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message: `Rate limit exceeded. ${result.reason === "burst" ? "Too many requests in a short period." : "Please try again later."}`,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}
