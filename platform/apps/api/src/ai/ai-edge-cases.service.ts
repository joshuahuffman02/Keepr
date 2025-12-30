import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Edge case handling result
 */
export interface EdgeCaseResult {
    handled: boolean;
    type?: 'vague' | 'impossible' | 'typo' | 'out_of_scope' | 'ambiguous';
    clarificationNeeded?: string;
    suggestions?: string[];
    correctedQuery?: string;
    originalQuery: string;
    confidence: number;
}

/**
 * Site type mapping for fuzzy matching
 */
const SITE_TYPE_ALIASES: Record<string, string[]> = {
    'rv': ['rv', 'recreational vehicle', 'motorhome', 'motor home', 'camper', 'travel trailer', 'fifth wheel', '5th wheel', 'class a', 'class b', 'class c'],
    'tent': ['tent', 'tenting', 'camping', 'primitive', 'backpacking'],
    'cabin': ['cabin', 'cabins', 'cottage', 'cottages', 'lodge', 'lodging'],
    'glamping': ['glamping', 'glamorous camping', 'yurt', 'safari tent', 'treehouse', 'tree house'],
    'lodging': ['lodging', 'room', 'hotel', 'motel', 'suite', 'accommodation'],
};

/**
 * Common amenity aliases
 */
const AMENITY_ALIASES: Record<string, string[]> = {
    'full_hookups': ['full hookups', 'full hookup', 'full hook-up', 'full hook-ups', 'fhu', 'all utilities'],
    'electric': ['electric', 'electricity', 'power', '30 amp', '50 amp', '30amp', '50amp', 'outlet'],
    'water': ['water', 'water hookup', 'water hook-up', 'running water'],
    'sewer': ['sewer', 'sewage', 'sewer hookup', 'sewer hook-up', 'dump'],
    'wifi': ['wifi', 'wi-fi', 'wireless', 'internet', 'web access'],
    'pet_friendly': ['pet friendly', 'pet-friendly', 'pets allowed', 'dogs allowed', 'dog friendly'],
    'waterfront': ['waterfront', 'water front', 'lakefront', 'lake front', 'riverside', 'riverfront', 'beachfront', 'oceanfront'],
    'accessible': ['accessible', 'ada', 'wheelchair', 'handicap', 'disability'],
};

/**
 * Common typo corrections
 */
const COMMON_TYPOS: Record<string, string> = {
    'campign': 'camping',
    'campng': 'camping',
    'campping': 'camping',
    'cabbin': 'cabin',
    'caben': 'cabin',
    'tnet': 'tent',
    'tennt': 'tent',
    'rv siet': 'rv site',
    'rv sote': 'rv site',
    'reservaton': 'reservation',
    'reservtion': 'reservation',
    'availibility': 'availability',
    'availabilty': 'availability',
    'avialable': 'available',
    'wekend': 'weekend',
    'weeknd': 'weekend',
    'wekkend': 'weekend',
    'tommorow': 'tomorrow',
    'tommorrow': 'tomorrow',
    'tomorow': 'tomorrow',
    'wterfront': 'waterfront',
    'watrefrnt': 'waterfront',
    'accomodation': 'accommodation',
    'acommodation': 'accommodation',
    'hookps': 'hookups',
    'hookupss': 'hookups',
    'electirc': 'electric',
    'eletric': 'electric',
    'sewar': 'sewer',
    'sewr': 'sewer',
};

@Injectable()
export class AiEdgeCasesService {
    private readonly logger = new Logger(AiEdgeCasesService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Analyze a query for edge cases and handle them appropriately
     */
    async analyzeQuery(
        campgroundId: string,
        query: string,
        context?: {
            siteTypes?: string[];
            amenities?: string[];
            maxDate?: Date;
            minDate?: Date;
        }
    ): Promise<EdgeCaseResult> {
        const normalizedQuery = query.trim().toLowerCase();

        // Check for empty or too short queries
        if (!normalizedQuery || normalizedQuery.length < 3) {
            return {
                handled: true,
                type: 'vague',
                clarificationNeeded: 'Your query is too short. What are you looking for? For example, you could ask "Show me RV sites available next weekend" or "Find a pet-friendly cabin for July 4th".',
                originalQuery: query,
                confidence: 1.0,
            };
        }

        // Apply typo corrections
        const correctedQuery = this.correctTypos(normalizedQuery);
        const hadTypos = correctedQuery !== normalizedQuery;

        // Check for impossible date requests
        const dateCheck = await this.checkDates(correctedQuery, context?.minDate, context?.maxDate);
        if (dateCheck.handled) {
            return { ...dateCheck, originalQuery: query };
        }

        // Check for non-existent site types
        const siteTypeCheck = await this.checkSiteTypes(campgroundId, correctedQuery, context?.siteTypes);
        if (siteTypeCheck.handled) {
            return { ...siteTypeCheck, originalQuery: query, correctedQuery: hadTypos ? correctedQuery : undefined };
        }

        // Check for vague queries
        const vagueCheck = this.checkVagueQuery(correctedQuery);
        if (vagueCheck.handled) {
            return { ...vagueCheck, originalQuery: query, correctedQuery: hadTypos ? correctedQuery : undefined };
        }

        // Check for out-of-scope requests
        const scopeCheck = this.checkOutOfScope(correctedQuery);
        if (scopeCheck.handled) {
            return { ...scopeCheck, originalQuery: query };
        }

        // Check for ambiguous queries
        const ambiguityCheck = this.checkAmbiguity(correctedQuery);
        if (ambiguityCheck.handled) {
            return { ...ambiguityCheck, originalQuery: query, correctedQuery: hadTypos ? correctedQuery : undefined };
        }

        // No edge case detected - return with typo correction if applicable
        return {
            handled: false,
            originalQuery: query,
            correctedQuery: hadTypos ? correctedQuery : undefined,
            confidence: hadTypos ? 0.8 : 1.0,
        };
    }

    /**
     * Correct common typos in a query
     */
    correctTypos(query: string): string {
        let corrected = query;

        for (const [typo, correction] of Object.entries(COMMON_TYPOS)) {
            const regex = new RegExp(`\\b${typo}\\b`, 'gi');
            corrected = corrected.replace(regex, correction);
        }

        return corrected;
    }

    /**
     * Check for impossible date requests
     */
    private async checkDates(
        query: string,
        minDate?: Date,
        maxDate?: Date
    ): Promise<EdgeCaseResult> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check for past date patterns
        const pastPatterns = [
            /last (week|month|year)/i,
            /yesterday/i,
            /(january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}(?:st|nd|rd|th)?,? 20\d{2}/i,
        ];

        for (const pattern of pastPatterns) {
            const match = query.match(pattern);
            if (match) {
                // Try to parse the date and check if it's in the past
                const dateStr = match[0];
                const parsed = this.parseDateFromString(dateStr);
                if (parsed && parsed < today) {
                    return {
                        handled: true,
                        type: 'impossible',
                        clarificationNeeded: `It looks like you mentioned a date in the past (${dateStr}). Reservations can only be made for future dates. Did you mean an upcoming date?`,
                        suggestions: [
                            `For the next occurrence, try "next ${dateStr.replace(/last /i, '')}"`,
                            'Or specify a future date like "next Saturday" or "July 4th, 2025"',
                        ],
                        originalQuery: query,
                        confidence: 0.9,
                    };
                }
            }
        }

        // Check for dates too far in the future (if maxDate is set)
        if (maxDate) {
            const farFuturePatterns = [
                /20\d{2}/,
            ];

            for (const pattern of farFuturePatterns) {
                const match = query.match(pattern);
                if (match) {
                    const year = parseInt(match[0]);
                    if (year > maxDate.getFullYear()) {
                        return {
                            handled: true,
                            type: 'impossible',
                            clarificationNeeded: `We can only accept reservations up to ${maxDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Please choose a date within our booking window.`,
                            originalQuery: query,
                            confidence: 0.9,
                        };
                    }
                }
            }
        }

        return { handled: false, originalQuery: query, confidence: 1.0 };
    }

    /**
     * Check for non-existent site types at this campground
     */
    private async checkSiteTypes(
        campgroundId: string,
        query: string,
        availableSiteTypes?: string[]
    ): Promise<EdgeCaseResult> {
        // Get available site types if not provided
        let siteTypes = availableSiteTypes;
        if (!siteTypes) {
            const siteClasses = await this.prisma.siteClass.findMany({
                where: { campgroundId },
                select: { siteType: true, name: true },
            });
            siteTypes = [...new Set(siteClasses.map(sc => sc.siteType?.toLowerCase()).filter(Boolean))] as string[];
        }

        // Check what site type the user is asking for
        for (const [type, aliases] of Object.entries(SITE_TYPE_ALIASES)) {
            for (const alias of aliases) {
                if (query.includes(alias)) {
                    // User is looking for this type
                    const normalizedType = type.toLowerCase();
                    const hasType = siteTypes.some(st => {
                        const stLower = st.toLowerCase();
                        return stLower === normalizedType ||
                            stLower.includes(normalizedType) ||
                            SITE_TYPE_ALIASES[normalizedType]?.some(a => stLower.includes(a));
                    });

                    if (!hasType) {
                        const availableTypesFormatted = siteTypes.length > 0
                            ? siteTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                            : 'various site types';

                        return {
                            handled: true,
                            type: 'impossible',
                            clarificationNeeded: `This campground doesn't have ${type} sites. Available options are: ${availableTypesFormatted}.`,
                            suggestions: siteTypes.map(t => `Search for ${t} sites instead`),
                            originalQuery: query,
                            confidence: 0.85,
                        };
                    }
                    break;
                }
            }
        }

        return { handled: false, originalQuery: query, confidence: 1.0 };
    }

    /**
     * Check for vague queries that need clarification
     */
    private checkVagueQuery(query: string): EdgeCaseResult {
        const vaguePatterns = [
            { pattern: /^(hi|hello|hey|what|how|help)$/i, type: 'greeting' },
            { pattern: /^(book|reserve|reservation|booking)$/i, type: 'action_only' },
            { pattern: /^(site|spot|space|campsite)$/i, type: 'noun_only' },
            { pattern: /^what.*(have|got|available)\??$/i, type: 'too_general' },
            { pattern: /^anything available\??$/i, type: 'no_dates' },
            { pattern: /^show me (sites|options|what you have)$/i, type: 'no_criteria' },
        ];

        for (const { pattern, type } of vaguePatterns) {
            if (pattern.test(query)) {
                let clarification: string;
                let suggestions: string[];

                switch (type) {
                    case 'greeting':
                        clarification = 'Hello! I can help you find and book a campsite. What dates are you looking for, and what type of site do you need (RV, tent, cabin)?';
                        suggestions = [
                            'RV site for next weekend',
                            'Tent camping July 4th-7th',
                            'Cabin with lake view in August',
                        ];
                        break;
                    case 'action_only':
                    case 'noun_only':
                    case 'no_criteria':
                        clarification = 'I need a bit more information to help you. When would you like to stay, and what type of site are you looking for?';
                        suggestions = [
                            'Tell me your arrival and departure dates',
                            'Specify site type: RV, tent, cabin, or glamping',
                            'Add preferences like pet-friendly or waterfront',
                        ];
                        break;
                    case 'too_general':
                    case 'no_dates':
                        clarification = 'To check availability, I need to know your dates. When are you planning to visit?';
                        suggestions = [
                            'Next weekend',
                            'June 15-20',
                            '2 weeks from now for 3 nights',
                        ];
                        break;
                    default:
                        clarification = 'Could you provide more details about what you are looking for?';
                        suggestions = [];
                }

                return {
                    handled: true,
                    type: 'vague',
                    clarificationNeeded: clarification,
                    suggestions,
                    originalQuery: query,
                    confidence: 0.9,
                };
            }
        }

        // Check for queries missing essential info (dates)
        const hasDateIndicator = /\b(today|tomorrow|tonight|next|this|on|for|from|until|through|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|weekend|week|month)\b/i.test(query);

        if (!hasDateIndicator && query.length > 10) {
            // Query has content but no dates
            return {
                handled: true,
                type: 'vague',
                clarificationNeeded: 'When are you planning to stay? I need dates to check availability.',
                suggestions: [
                    'Add "next weekend" to your search',
                    'Specify dates like "July 4-7"',
                    'Or say "this Friday for 2 nights"',
                ],
                originalQuery: query,
                confidence: 0.7,
            };
        }

        return { handled: false, originalQuery: query, confidence: 1.0 };
    }

    /**
     * Check for out-of-scope requests
     */
    private checkOutOfScope(query: string): EdgeCaseResult {
        const outOfScopePatterns = [
            { pattern: /weather forecast|temperature|rain/i, response: 'weather information', suggestion: 'check a weather service like weather.com' },
            { pattern: /restaurant|food|dining|eat/i, response: 'restaurant recommendations', suggestion: 'ask about our camp store or on-site amenities instead' },
            { pattern: /directions|how (do i|to) get|drive|map/i, response: 'driving directions', suggestion: 'use Google Maps or your GPS with our address' },
            { pattern: /nearby|attractions|things to do|activities/i, response: null, suggestion: null }, // Allow these - they're related to camping
            { pattern: /wifi password|internet code/i, response: 'WiFi credentials', suggestion: 'ask at the front desk when you check in' },
            { pattern: /cancel my|refund|money back/i, response: null, suggestion: null }, // Allow - this is a reservation action
            { pattern: /complaint|manager|supervisor/i, response: 'customer service escalation', suggestion: 'contact us directly at our main phone number or email' },
            { pattern: /other campground|competitor|compare/i, response: 'information about other campgrounds', suggestion: 'search campground directories or review sites' },
        ];

        for (const { pattern, response, suggestion } of outOfScopePatterns) {
            if (pattern.test(query) && response !== null) {
                return {
                    handled: true,
                    type: 'out_of_scope',
                    clarificationNeeded: `I can help with campsite reservations and availability, but I cannot provide ${response}. ${suggestion ? `You might want to ${suggestion}.` : ''}`,
                    suggestions: [
                        'Search for available sites',
                        'Check availability for specific dates',
                        'Ask about site amenities',
                    ],
                    originalQuery: query,
                    confidence: 0.8,
                };
            }
        }

        return { handled: false, originalQuery: query, confidence: 1.0 };
    }

    /**
     * Check for ambiguous queries
     */
    private checkAmbiguity(query: string): EdgeCaseResult {
        // Check for conflicting site types
        const mentionedTypes: string[] = [];
        for (const [type, aliases] of Object.entries(SITE_TYPE_ALIASES)) {
            for (const alias of aliases) {
                if (query.includes(alias)) {
                    if (!mentionedTypes.includes(type)) {
                        mentionedTypes.push(type);
                    }
                    break;
                }
            }
        }

        if (mentionedTypes.length > 1) {
            return {
                handled: true,
                type: 'ambiguous',
                clarificationNeeded: `You mentioned multiple site types (${mentionedTypes.join(' and ')}). Which type would you prefer?`,
                suggestions: mentionedTypes.map(t => `Search for ${t} sites only`),
                originalQuery: query,
                confidence: 0.85,
            };
        }

        // Check for date ambiguity (e.g., "Friday" without specifying which Friday)
        const dayOfWeekPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        const hasSpecificDate = /\b(next|this|coming|following|\d{1,2}[\/\-]\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december \d)/i.test(query);

        const dayMatch = query.match(dayOfWeekPattern);
        if (dayMatch && !hasSpecificDate) {
            return {
                handled: true,
                type: 'ambiguous',
                clarificationNeeded: `You mentioned ${dayMatch[0]}. Did you mean this coming ${dayMatch[0]} or a ${dayMatch[0]} further out?`,
                suggestions: [
                    `This ${dayMatch[0]}`,
                    `Next ${dayMatch[0]}`,
                    'A specific date (e.g., January 15th)',
                ],
                originalQuery: query,
                confidence: 0.7,
            };
        }

        return { handled: false, originalQuery: query, confidence: 1.0 };
    }

    /**
     * Get fuzzy match suggestions for amenities
     */
    getAmenitySuggestions(input: string, availableAmenities: string[]): string[] {
        const normalizedInput = input.toLowerCase();
        const suggestions: string[] = [];

        // Check against known aliases
        for (const [amenity, aliases] of Object.entries(AMENITY_ALIASES)) {
            for (const alias of aliases) {
                if (normalizedInput.includes(alias) || this.levenshteinDistance(normalizedInput, alias) <= 2) {
                    if (availableAmenities.includes(amenity)) {
                        suggestions.push(amenity);
                    }
                    break;
                }
            }
        }

        // Also check direct fuzzy matches against available amenities
        for (const amenity of availableAmenities) {
            if (this.levenshteinDistance(normalizedInput, amenity.toLowerCase()) <= 2) {
                if (!suggestions.includes(amenity)) {
                    suggestions.push(amenity);
                }
            }
        }

        return suggestions;
    }

    /**
     * Parse a date string into a Date object
     */
    private parseDateFromString(dateStr: string): Date | null {
        const now = new Date();

        // Try to parse "January 15th, 2024" style dates
        const monthDayYear = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i);
        if (monthDayYear) {
            const months: Record<string, number> = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3,
                'may': 4, 'june': 5, 'july': 6, 'august': 7,
                'september': 8, 'october': 9, 'november': 10, 'december': 11,
            };
            const month = months[monthDayYear[1].toLowerCase()];
            const day = parseInt(monthDayYear[2]);
            const year = monthDayYear[3] ? parseInt(monthDayYear[3]) : now.getFullYear();
            return new Date(year, month, day);
        }

        // Handle "last week/month/year"
        if (/last week/i.test(dateStr)) {
            const date = new Date(now);
            date.setDate(date.getDate() - 7);
            return date;
        }
        if (/last month/i.test(dateStr)) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - 1);
            return date;
        }
        if (/last year/i.test(dateStr)) {
            const date = new Date(now);
            date.setFullYear(date.getFullYear() - 1);
            return date;
        }

        // Handle "yesterday"
        if (/yesterday/i.test(dateStr)) {
            const date = new Date(now);
            date.setDate(date.getDate() - 1);
            return date;
        }

        return null;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const m = str1.length;
        const n = str2.length;
        const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }

        return dp[m][n];
    }

    /**
     * Generate a helpful error message for failed requests
     */
    generateHelpfulError(error: Error, context?: string): {
        message: string;
        suggestions: string[];
        retry: boolean;
    } {
        const errorMessage = error.message.toLowerCase();

        // API/Network errors
        if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
            return {
                message: 'There was a connection issue. Please try again in a moment.',
                suggestions: [
                    'Check your internet connection',
                    'Try refreshing the page',
                    'If the problem persists, try a simpler search',
                ],
                retry: true,
            };
        }

        // Rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return {
                message: 'We are processing many requests right now. Please wait a moment and try again.',
                suggestions: [
                    'Wait 30 seconds before retrying',
                    'Try a more specific search to reduce processing',
                ],
                retry: true,
            };
        }

        // Invalid input
        if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
            return {
                message: 'There was an issue with your request. Please check your input and try again.',
                suggestions: [
                    'Make sure dates are in the future',
                    'Use a recognized site type (RV, tent, cabin)',
                    'Double-check the number of guests',
                ],
                retry: false,
            };
        }

        // Not found
        if (errorMessage.includes('not found') || errorMessage.includes('no results')) {
            return {
                message: context || 'No matching options were found for your criteria.',
                suggestions: [
                    'Try different dates',
                    'Expand your search criteria',
                    'Check if you have any typos',
                ],
                retry: false,
            };
        }

        // Default
        return {
            message: 'Something went wrong. Please try again or rephrase your request.',
            suggestions: [
                'Try a simpler search',
                'Make sure your request is clear and specific',
                'Contact support if the issue persists',
            ],
            retry: true,
        };
    }
}
