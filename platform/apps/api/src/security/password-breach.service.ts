import { Injectable, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";

/**
 * Password Breach Checking Service
 *
 * Uses the HaveIBeenPwned API to check if a password has been
 * compromised in known data breaches.
 *
 * Uses k-Anonymity model:
 * - Only sends first 5 chars of SHA-1 hash to API
 * - API returns all hashes starting with those 5 chars
 * - We check locally for a match
 * - This means HIBP never sees the full password hash
 *
 * Reference: https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange
 */
@Injectable()
export class PasswordBreachService {
    private readonly apiUrl = "https://api.pwnedpasswords.com/range/";
    private readonly enabled: boolean;
    private readonly blockBreached: boolean;
    private readonly minBreachCount: number;

    constructor() {
        // Configuration
        this.enabled = process.env.HIBP_ENABLED !== "false";
        this.blockBreached = process.env.HIBP_BLOCK_BREACHED === "true";
        this.minBreachCount = parseInt(process.env.HIBP_MIN_BREACH_COUNT || "1", 10);

        if (this.enabled) {
            console.log(`[SECURITY] Password breach checking enabled (block: ${this.blockBreached}, threshold: ${this.minBreachCount})`);
        }
    }

    /**
     * Check if a password has been exposed in known data breaches
     *
     * @param password The plaintext password to check
     * @returns Object with breach status and count
     */
    async checkPassword(password: string): Promise<{
        breached: boolean;
        count: number;
        message?: string;
    }> {
        if (!this.enabled) {
            return { breached: false, count: 0 };
        }

        try {
            // Hash the password with SHA-1 (HIBP uses SHA-1)
            const sha1Hash = createHash("sha1")
                .update(password)
                .digest("hex")
                .toUpperCase();

            // Split into prefix (first 5 chars) and suffix (rest)
            const prefix = sha1Hash.substring(0, 5);
            const suffix = sha1Hash.substring(5);

            // Call HIBP API with just the prefix (k-Anonymity)
            const response = await fetch(`${this.apiUrl}${prefix}`, {
                headers: {
                    "User-Agent": "CampReserv-Security-Check",
                    "Add-Padding": "true", // Add padding to prevent timing attacks
                },
            });

            if (!response.ok) {
                // If API fails, don't block the user - just log it
                console.warn(`[SECURITY] HIBP API returned ${response.status}`);
                return { breached: false, count: 0 };
            }

            const text = await response.text();
            const lines = text.split("\n");

            // Search for our hash suffix in the response
            for (const line of lines) {
                const [hashSuffix, count] = line.split(":");
                if (hashSuffix.trim() === suffix) {
                    const breachCount = parseInt(count.trim(), 10) || 0;

                    if (breachCount >= this.minBreachCount) {
                        return {
                            breached: true,
                            count: breachCount,
                            message: `This password has been exposed in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
                        };
                    }
                }
            }

            return { breached: false, count: 0 };
        } catch (error) {
            // Log but don't block on API errors
            console.error("[SECURITY] HIBP check failed:", error);
            return { breached: false, count: 0 };
        }
    }

    /**
     * Check password and throw if breached (when blocking is enabled)
     *
     * @param password The plaintext password to check
     * @throws BadRequestException if password is breached and blocking is enabled
     */
    async checkAndThrowIfBreached(password: string): Promise<void> {
        if (!this.blockBreached) {
            return;
        }

        const result = await this.checkPassword(password);

        if (result.breached) {
            throw new BadRequestException(
                result.message || "This password has been exposed in data breaches. Please choose a different password."
            );
        }
    }

    /**
     * Validate password strength and breach status
     * Returns warnings but doesn't throw
     *
     * @param password The plaintext password to check
     * @returns Array of warning messages
     */
    async validatePasswordWithWarnings(password: string): Promise<string[]> {
        const warnings: string[] = [];

        // Basic strength checks
        if (password.length < 12) {
            warnings.push("Password should be at least 12 characters long");
        }

        if (!/[A-Z]/.test(password)) {
            warnings.push("Password should contain at least one uppercase letter");
        }

        if (!/[a-z]/.test(password)) {
            warnings.push("Password should contain at least one lowercase letter");
        }

        if (!/[0-9]/.test(password)) {
            warnings.push("Password should contain at least one number");
        }

        if (!/[^A-Za-z0-9]/.test(password)) {
            warnings.push("Password should contain at least one special character");
        }

        // Common patterns to avoid
        const commonPatterns = [
            /^password/i,
            /^123456/,
            /^qwerty/i,
            /^admin/i,
            /^letmein/i,
            /^welcome/i,
            /^campground/i,
            /^camping/i,
        ];

        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                warnings.push("Password contains a common pattern that is easy to guess");
                break;
            }
        }

        // Check for breaches
        const breachResult = await this.checkPassword(password);
        if (breachResult.breached) {
            warnings.push(
                `This password has appeared in ${breachResult.count.toLocaleString()} known data breaches`
            );
        }

        return warnings;
    }

    /**
     * Get service status for health checks
     */
    async getStatus(): Promise<{
        enabled: boolean;
        blocking: boolean;
        apiReachable: boolean;
    }> {
        let apiReachable = false;

        if (this.enabled) {
            try {
                // Use a known hash prefix to test API
                const response = await fetch(`${this.apiUrl}00000`, {
                    headers: { "User-Agent": "CampReserv-Health-Check" },
                });
                apiReachable = response.ok;
            } catch {
                apiReachable = false;
            }
        }

        return {
            enabled: this.enabled,
            blocking: this.blockBreached,
            apiReachable,
        };
    }
}
