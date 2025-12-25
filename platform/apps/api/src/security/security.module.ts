import { Module, Global } from "@nestjs/common";
import { CsrfService } from "./csrf.service";
import { CsrfGuard } from "./csrf.guard";
import { AccountLockoutService } from "./account-lockout.service";
import { PasswordBreachService } from "./password-breach.service";
import { TotpService } from "./totp.service";
import { PiiEncryptionService } from "./pii-encryption.service";
import { RedisRateLimitService } from "./redis-rate-limit.service";
import { SecurityEventsService } from "./security-events.service";

/**
 * Security Module
 *
 * Provides comprehensive security services:
 * - CSRF protection (Double Submit Cookie pattern)
 * - Account lockout after failed login attempts
 * - Password breach checking via HaveIBeenPwned API
 * - TOTP-based 2FA/MFA
 * - PII encryption (AES-256-GCM column-level encryption)
 * - Redis-backed rate limiting (sliding window)
 * - Security event logging and alerting
 */
@Global()
@Module({
    providers: [
        CsrfService,
        CsrfGuard,
        AccountLockoutService,
        PasswordBreachService,
        TotpService,
        PiiEncryptionService,
        RedisRateLimitService,
        SecurityEventsService,
    ],
    exports: [
        CsrfService,
        CsrfGuard,
        AccountLockoutService,
        PasswordBreachService,
        TotpService,
        PiiEncryptionService,
        RedisRateLimitService,
        SecurityEventsService,
    ],
})
export class SecurityModule {}
