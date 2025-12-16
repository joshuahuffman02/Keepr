import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

interface AnonymizedResult {
    anonymizedText: string;
    tokenMap: Map<string, string>;
}

interface PiiPattern {
    pattern: RegExp;
    type: 'email' | 'phone' | 'name' | 'address' | 'date' | 'credit_card';
    placeholder: string;
}

@Injectable()
export class AiPrivacyService {
    private piiPatterns: PiiPattern[] = [
        // Email addresses
        { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, type: 'email', placeholder: '[EMAIL]' },
        // Phone numbers (various formats)
        { pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, type: 'phone', placeholder: '[PHONE]' },
        // Credit card numbers
        { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, type: 'credit_card', placeholder: '[CARD]' },
        // Dates in various formats
        { pattern: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, type: 'date', placeholder: '[DATE]' },
        // SSN-like patterns
        { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, type: 'address', placeholder: '[ID]' },
    ];

    /**
     * Strips PII from text and returns anonymized version with a map for de-anonymization
     */
    anonymize(text: string, level: 'strict' | 'moderate' | 'minimal' = 'strict'): AnonymizedResult {
        let anonymizedText = text;
        const tokenMap = new Map<string, string>();
        let tokenCounter = 0;

        // Apply PII patterns
        for (const { pattern, placeholder } of this.piiPatterns) {
            anonymizedText = anonymizedText.replace(pattern, (match) => {
                const token = `${placeholder}_${++tokenCounter}`;
                tokenMap.set(token, match);
                return token;
            });
        }

        if (level === 'strict' || level === 'moderate') {
            // Additional name detection (simple heuristic: capitalized words)
            anonymizedText = this.anonymizeNames(anonymizedText, tokenMap, tokenCounter);
        }

        return { anonymizedText, tokenMap };
    }

    /**
     * De-anonymize text by replacing tokens with original values
     */
    deanonymize(text: string, tokenMap: Map<string, string>): string {
        let result = text;
        for (const [token, original] of tokenMap) {
            result = result.replace(new RegExp(this.escapeRegex(token), 'g'), original);
        }
        return result;
    }

    /**
     * Hash content for audit logging (one-way, no recovery)
     */
    hashForAudit(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Hash an IP address for compliance logging
     */
    hashIp(ip: string): string {
        // Add a salt to prevent rainbow table attacks
        const salt = process.env.IP_HASH_SALT || 'campreserv-default-salt';
        return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
    }

    /**
     * Anonymize guest data for AI context
     */
    anonymizeGuestContext(guest: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
    }): { anonymized: Record<string, string>; tokenMap: Map<string, string> } {
        const tokenMap = new Map<string, string>();
        const anonymized: Record<string, string> = {};

        if (guest.firstName) {
            tokenMap.set('[GUEST_FIRST]', guest.firstName);
            anonymized.firstName = '[GUEST_FIRST]';
        }
        if (guest.lastName) {
            tokenMap.set('[GUEST_LAST]', guest.lastName);
            anonymized.lastName = '[GUEST_LAST]';
        }
        if (guest.email) {
            tokenMap.set('[GUEST_EMAIL]', guest.email);
            anonymized.email = '[GUEST_EMAIL]';
        }
        if (guest.phone) {
            tokenMap.set('[GUEST_PHONE]', guest.phone);
            anonymized.phone = '[GUEST_PHONE]';
        }

        return { anonymized, tokenMap };
    }

    /**
     * Anonymize site/campground names
     */
    anonymizeSiteContext(sites: { id: string; name: string }[]): {
        anonymized: { id: string; name: string }[];
        tokenMap: Map<string, string>;
    } {
        const tokenMap = new Map<string, string>();
        const anonymized = sites.map((site, index) => {
            const placeholder = `[SITE_${String.fromCharCode(65 + index)}]`; // SITE_A, SITE_B, etc.
            tokenMap.set(placeholder, site.name);
            return { id: site.id, name: placeholder };
        });

        return { anonymized, tokenMap };
    }

    private anonymizeNames(text: string, tokenMap: Map<string, string>, startCounter: number): string {
        // Simple heuristic: look for sequences of capitalized words that might be names
        // This is imperfect but catches many common cases
        const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
        let counter = startCounter;

        return text.replace(namePattern, (match) => {
            // Skip common non-name phrases
            const commonPhrases = ['United States', 'New York', 'Los Angeles', 'San Francisco'];
            if (commonPhrases.some(phrase => match.includes(phrase))) {
                return match;
            }
            const token = `[NAME_${++counter}]`;
            tokenMap.set(token, match);
            return token;
        });
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
