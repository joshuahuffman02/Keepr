import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CsrfService } from "./csrf.service";

/**
 * Decorator to skip CSRF check on specific routes
 */
export const SkipCsrf = () => {
    return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
            Reflect.defineMetadata("skipCsrf", true, descriptor.value);
            return descriptor;
        }
        Reflect.defineMetadata("skipCsrf", true, target);
        return target;
    };
};

/**
 * CSRF Guard
 *
 * Validates CSRF tokens for mutating requests (POST, PUT, PATCH, DELETE).
 * Uses the Double Submit Cookie pattern.
 *
 * Skips validation for:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Requests with @SkipCsrf() decorator
 * - API token authenticated requests (they use different auth)
 * - Webhook endpoints
 */
@Injectable()
export class CsrfGuard implements CanActivate {
    // Paths that don't need CSRF protection
    private readonly exemptPaths = [
        "/api/auth/", // Auth endpoints handle their own security
        "/api/webhooks/", // Webhooks use signature verification
        "/api/developer/", // API token auth doesn't need CSRF
        "/api/public/", // Public endpoints
        "/api/guest-auth/", // Guest magic links
    ];

    // Safe HTTP methods that don't need CSRF
    private readonly safeMethods = ["GET", "HEAD", "OPTIONS"];

    constructor(
        private readonly csrfService: CsrfService,
        private readonly reflector: Reflector,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Always set/refresh CSRF cookie for browser clients
        this.ensureCsrfCookie(request, response);

        // Skip for safe methods
        if (this.safeMethods.includes(request.method?.toUpperCase())) {
            return true;
        }

        // Check for @SkipCsrf decorator
        const skipCsrf = this.reflector.get<boolean>("skipCsrf", context.getHandler());
        if (skipCsrf) {
            return true;
        }

        // Skip for exempt paths
        const path = request.path || request.url;
        if (this.exemptPaths.some(exempt => path.startsWith(exempt))) {
            return true;
        }

        // Skip if using API token authentication (Bearer token from developer API)
        if (request.apiPrincipal) {
            return true;
        }

        // Skip if request has no origin/referer (likely not from browser)
        const origin = request.headers.origin;
        const referer = request.headers.referer;
        if (!origin && !referer) {
            // Could be from mobile app, Postman, etc.
            // You might want to make this stricter in production
            return true;
        }

        // Validate CSRF token
        const cookieToken = request.cookies?.[this.csrfService.getCookieName()];
        const headerToken = request.headers[this.csrfService.getHeaderName()];

        if (!this.csrfService.validateRequest(cookieToken, headerToken)) {
            throw new ForbiddenException("Invalid CSRF token");
        }

        return true;
    }

    /**
     * Ensure CSRF cookie is set for browser clients
     */
    private ensureCsrfCookie(request: any, response: any): void {
        const existingCookie = request.cookies?.[this.csrfService.getCookieName()];

        // Check if existing cookie is valid
        if (existingCookie) {
            const { valid } = this.csrfService.parseCookieValue(existingCookie);
            if (valid) {
                return; // Cookie is valid, no need to refresh
            }
        }

        // Generate new CSRF token and set cookie
        const cookieValue = this.csrfService.createCookieValue();
        response.cookie(
            this.csrfService.getCookieName(),
            cookieValue,
            this.csrfService.cookieOptions
        );
    }
}
