import { Injectable, UnauthorizedException } from "@nestjs/common";

/**
 * Account Lockout Service
 *
 * Tracks failed login attempts and locks accounts temporarily
 * after too many failures to prevent brute force attacks.
 *
 * Default settings:
 * - Lock after 5 failed attempts
 * - Lock duration: 15 minutes
 * - Reset on successful login
 *
 * TODO: Migrate to Redis for distributed locking
 */
interface LockoutRecord {
    attempts: number;
    firstAttempt: number;
    lockedUntil: number | null;
    lastAttempt: number;
}

@Injectable()
export class AccountLockoutService {
    // In-memory store - should migrate to Redis for production
    private readonly attempts = new Map<string, LockoutRecord>();

    // Configuration
    private readonly maxAttempts = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || "5", 10);
    private readonly lockDurationMs = parseInt(process.env.LOCKOUT_DURATION_MS || String(15 * 60 * 1000), 10); // 15 minutes
    private readonly attemptWindowMs = parseInt(process.env.LOCKOUT_WINDOW_MS || String(60 * 60 * 1000), 10); // 1 hour

    // Cleanup interval (every 5 minutes)
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start cleanup interval to prevent memory leaks
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        console.log(`[SECURITY] Account lockout enabled: ${this.maxAttempts} attempts, ${this.lockDurationMs / 1000}s lock`);
    }

    /**
     * Check if an account/IP is currently locked
     * @param identifier Email address or IP address
     * @returns Whether the account is locked
     */
    isLocked(identifier: string): boolean {
        const record = this.attempts.get(identifier.toLowerCase());

        if (!record || !record.lockedUntil) {
            return false;
        }

        const now = Date.now();

        // Check if lock has expired
        if (record.lockedUntil <= now) {
            // Lock expired, remove it
            this.attempts.delete(identifier.toLowerCase());
            return false;
        }

        return true;
    }

    /**
     * Get remaining lockout time in seconds
     */
    getRemainingLockoutTime(identifier: string): number {
        const record = this.attempts.get(identifier.toLowerCase());

        if (!record || !record.lockedUntil) {
            return 0;
        }

        const remaining = Math.max(0, record.lockedUntil - Date.now());
        return Math.ceil(remaining / 1000);
    }

    /**
     * Record a failed login attempt
     * @param identifier Email address or IP address
     * @returns Whether the account is now locked
     */
    recordFailedAttempt(identifier: string): { locked: boolean; attemptsRemaining: number; lockDuration?: number } {
        const key = identifier.toLowerCase();
        const now = Date.now();

        let record = this.attempts.get(key);

        // Check if we need to start fresh
        if (!record || (now - record.firstAttempt > this.attemptWindowMs)) {
            record = {
                attempts: 0,
                firstAttempt: now,
                lockedUntil: null,
                lastAttempt: now,
            };
        }

        // If already locked, return locked status
        if (record.lockedUntil && record.lockedUntil > now) {
            return {
                locked: true,
                attemptsRemaining: 0,
                lockDuration: this.getRemainingLockoutTime(key),
            };
        }

        // Increment attempts
        record.attempts++;
        record.lastAttempt = now;

        // Check if we should lock
        if (record.attempts >= this.maxAttempts) {
            record.lockedUntil = now + this.lockDurationMs;
            this.attempts.set(key, record);

            console.log(`[SECURITY] Account locked: ${this.maskIdentifier(identifier)} for ${this.lockDurationMs / 1000}s after ${record.attempts} failed attempts`);

            return {
                locked: true,
                attemptsRemaining: 0,
                lockDuration: Math.ceil(this.lockDurationMs / 1000),
            };
        }

        this.attempts.set(key, record);

        return {
            locked: false,
            attemptsRemaining: this.maxAttempts - record.attempts,
        };
    }

    /**
     * Record a successful login - resets the lockout counter
     * @param identifier Email address or IP address
     */
    recordSuccessfulLogin(identifier: string): void {
        this.attempts.delete(identifier.toLowerCase());
    }

    /**
     * Check login and throw if locked
     * @param identifier Email address or IP address
     * @throws UnauthorizedException if account is locked
     */
    checkAndThrowIfLocked(identifier: string): void {
        if (this.isLocked(identifier)) {
            const remaining = this.getRemainingLockoutTime(identifier);
            throw new UnauthorizedException(
                `Account temporarily locked due to too many failed attempts. Try again in ${remaining} seconds.`
            );
        }
    }

    /**
     * Handle a failed login and return lock status
     * @param identifier Email address or IP address
     * @returns Lock status with attempt count
     */
    handleFailedLogin(identifier: string): { locked: boolean; attempts: number; lockDuration?: number } {
        const result = this.recordFailedAttempt(identifier);
        const record = this.attempts.get(identifier.toLowerCase());

        return {
            locked: result.locked,
            attempts: record?.attempts || 1,
            lockDuration: result.lockDuration,
        };
    }

    /**
     * Handle a failed login and throw if now locked
     * @param identifier Email address or IP address
     * @throws UnauthorizedException with remaining attempts info
     */
    handleFailedLoginAndThrow(identifier: string): void {
        const result = this.recordFailedAttempt(identifier);

        if (result.locked) {
            throw new UnauthorizedException(
                `Account locked due to too many failed attempts. Try again in ${result.lockDuration} seconds.`
            );
        }
    }

    /**
     * Get attempt statistics for an identifier
     */
    getAttemptInfo(identifier: string): {
        attempts: number;
        remaining: number;
        locked: boolean;
        lockExpiresIn?: number;
    } {
        const record = this.attempts.get(identifier.toLowerCase());

        if (!record) {
            return {
                attempts: 0,
                remaining: this.maxAttempts,
                locked: false,
            };
        }

        const now = Date.now();
        const locked = record.lockedUntil !== null && record.lockedUntil > now;

        return {
            attempts: record.attempts,
            remaining: Math.max(0, this.maxAttempts - record.attempts),
            locked,
            lockExpiresIn: locked ? Math.ceil((record.lockedUntil! - now) / 1000) : undefined,
        };
    }

    /**
     * Manually unlock an account (admin function)
     */
    unlockAccount(identifier: string): boolean {
        const key = identifier.toLowerCase();
        const record = this.attempts.get(key);

        if (record) {
            this.attempts.delete(key);
            console.log(`[SECURITY] Account manually unlocked: ${this.maskIdentifier(identifier)}`);
            return true;
        }

        return false;
    }

    /**
     * Mask identifier for logging (privacy)
     */
    private maskIdentifier(identifier: string): string {
        if (identifier.includes("@")) {
            // Email
            const [local, domain] = identifier.split("@");
            return `${local.substring(0, 2)}***@${domain}`;
        }
        // IP address
        const parts = identifier.split(".");
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***`;
        }
        return `${identifier.substring(0, 4)}***`;
    }

    /**
     * Cleanup expired records to prevent memory leaks
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, record] of this.attempts.entries()) {
            // Remove if:
            // 1. Lock has expired and attempts window has passed
            // 2. No lock and attempts window has passed
            const windowExpired = now - record.firstAttempt > this.attemptWindowMs;
            const lockExpired = !record.lockedUntil || record.lockedUntil <= now;

            if (windowExpired && lockExpired) {
                this.attempts.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[SECURITY] Cleaned up ${cleaned} expired lockout records`);
        }
    }

    /**
     * Get current stats for monitoring
     */
    getStats(): { trackedAccounts: number; lockedAccounts: number } {
        const now = Date.now();
        let lockedCount = 0;

        for (const record of this.attempts.values()) {
            if (record.lockedUntil && record.lockedUntil > now) {
                lockedCount++;
            }
        }

        return {
            trackedAccounts: this.attempts.size,
            lockedAccounts: lockedCount,
        };
    }

    onModuleDestroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
