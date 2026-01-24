import { BadGatewayException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Parsed search intent from natural language query
 */
export interface SearchIntent {
  // Date preferences
  arrivalDate?: string; // ISO date
  departureDate?: string; // ISO date
  nights?: number;
  flexible?: boolean; // User is flexible on dates

  // Site preferences
  siteType?: "rv" | "tent" | "cabin" | "glamping" | "lodging" | null;
  rigType?: string;
  rigLength?: number;

  // Amenities
  amenities?: string[];
  petFriendly?: boolean;
  waterfront?: boolean;
  hookups?: {
    power?: boolean;
    water?: boolean;
    sewer?: boolean;
  };
  accessible?: boolean;

  // Capacity
  adults?: number;
  children?: number;
  pets?: number;

  // Price
  maxPricePerNight?: number; // In cents
  minPricePerNight?: number; // In cents

  // Other preferences
  quiet?: boolean;
  nearAmenities?: boolean;

  // Parsing metadata
  confidence: number; // 0-1 confidence in parsing
  clarificationNeeded?: string; // If AI needs more info
  interpretedQuery?: string; // AI's interpretation for user confirmation
}

/**
 * Search result with match explanation
 */
export interface NLSearchResult {
  siteId: string;
  siteName: string;
  siteNumber: string;
  siteType: string;
  siteClass: {
    id: string;
    name: string;
    defaultRate: number;
  };
  status: "available" | "booked" | "locked" | "maintenance";
  matchScore: number; // 0-100
  matchReasons: string[]; // Why this site matches
  pricePerNight?: number; // Cents
  totalPrice?: number; // Cents
  amenities?: string[];
}

export interface NLSearchResponse {
  intent: SearchIntent;
  results: NLSearchResult[];
  totalMatches: number;
  aiSuggestion?: string; // AI-generated suggestion or tip
  fallbackUsed?: boolean; // True if AI parsing failed and we used fallback
}

interface AvailableSiteRow {
  id: string;
  name: string | null;
  siteNumber: string | null;
  siteType: string | null;
  maxOccupancy: number | null;
  rigMaxLength: number | null;
  accessible: boolean | null;
  amenityTags: string[] | null;
  siteClassId: string | null;
  siteClassName: string | null;
  defaultRate: number | string | null;
  classSiteType: string | null;
  petFriendly: boolean | null;
  hookupsPower: boolean | null;
  hookupsWater: boolean | null;
  hookupsSewer: boolean | null;
  status: "available" | "booked" | "locked" | "maintenance";
}

const SEARCH_SYSTEM_PROMPT = `You are a campground booking assistant. Parse the user's natural language query into structured search parameters.

Today's date is {{TODAY}}.

Extract the following from the query:
- Dates: arrival date, departure date, or relative terms like "next weekend", "this Friday", "July 4th"
- Site type: RV, tent, cabin, glamping, lodging
- Rig details: RV type (motorhome, travel trailer), length in feet
- Amenities: pet-friendly, waterfront, full hookups, power/water/sewer, WiFi
- Accessibility: wheelchair accessible, ADA compliant
- Guests: number of adults, children, pets
- Price: maximum or minimum price per night, budget constraints
- Other: quiet location, near amenities, specific site requests

Respond with a JSON object matching this schema:
{
  "arrivalDate": "YYYY-MM-DD or null",
  "departureDate": "YYYY-MM-DD or null",
  "nights": number or null,
  "flexible": boolean,
  "siteType": "rv" | "tent" | "cabin" | "glamping" | "lodging" | null,
  "rigType": string or null,
  "rigLength": number or null (in feet),
  "amenities": string[] or [],
  "petFriendly": boolean or null,
  "waterfront": boolean or null,
  "hookups": { "power": boolean, "water": boolean, "sewer": boolean } or null,
  "accessible": boolean or null,
  "adults": number or null,
  "children": number or null,
  "pets": number or null,
  "maxPricePerNight": number or null (in dollars, will be converted to cents),
  "minPricePerNight": number or null (in dollars),
  "quiet": boolean or null,
  "nearAmenities": boolean or null,
  "confidence": number (0-1),
  "clarificationNeeded": string or null,
  "interpretedQuery": string (your interpretation of what they're looking for)
}

For relative dates:
- "next weekend" = next Saturday to Sunday
- "this weekend" = this Saturday to Sunday (or today if it's already weekend)
- "next Friday" = the upcoming Friday
- "July 4th" = July 4th of current year (or next year if past)
- "2 weeks from now" = 14 days from today

If the query is unclear or missing critical information (like dates), set clarificationNeeded to a friendly question.

RESPOND ONLY WITH THE JSON OBJECT, NO OTHER TEXT.`;

@Injectable()
export class AiNaturalSearchService {
  private readonly logger = new Logger(AiNaturalSearchService.name);

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Parse a natural language query into structured search intent
   */
  async parseQuery(campgroundId: string, query: string, sessionId?: string): Promise<SearchIntent> {
    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = SEARCH_SYSTEM_PROMPT.replace("{{TODAY}}", today);

    try {
      const response = await this.aiProvider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.booking_assist,
        systemPrompt,
        userPrompt: query,
        sessionId,
        maxTokens: 500,
        temperature: 0.3, // Lower temperature for more consistent parsing
      });

      // Parse the JSON response
      const parsed = this.parseAiResponse(response.content);

      // Convert price from dollars to cents
      if (parsed.maxPricePerNight) {
        parsed.maxPricePerNight = Math.round(parsed.maxPricePerNight * 100);
      }
      if (parsed.minPricePerNight) {
        parsed.minPricePerNight = Math.round(parsed.minPricePerNight * 100);
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse NL query: ${error}`);

      // Return a fallback intent that signals we need more info
      return {
        confidence: 0,
        clarificationNeeded:
          "I couldn't understand your search. Could you tell me when you'd like to arrive and what type of site you're looking for?",
        interpretedQuery: query,
      };
    }
  }

  /**
   * Search for available sites based on natural language query
   */
  async search(
    campgroundSlug: string,
    query: string,
    sessionId?: string,
  ): Promise<NLSearchResponse> {
    // Get campground by slug
    const campground = await this.prisma.campground.findFirst({
      where: { slug: campgroundSlug },
      select: { id: true, slug: true, aiEnabled: true },
    });

    if (!campground) {
      throw new NotFoundException("Campground not found");
    }

    let intent: SearchIntent;
    let fallbackUsed = false;

    // Try AI parsing if enabled
    if (campground.aiEnabled) {
      intent = await this.parseQuery(campground.id, query, sessionId);
    } else {
      // Fallback: try to extract dates from query using simple patterns
      intent = this.fallbackParse(query);
      fallbackUsed = true;
    }

    // If we don't have dates, we can't search for availability
    if (!intent.arrivalDate || !intent.departureDate) {
      return {
        intent,
        results: [],
        totalMatches: 0,
        aiSuggestion: intent.clarificationNeeded,
        fallbackUsed,
      };
    }

    // Get available sites using existing availability logic
    const sites = await this.getAvailableSites(campground.id, campgroundSlug, intent);

    // Score and sort sites based on how well they match the intent
    const scoredSites = this.scoreSites(sites, intent);

    // Generate AI suggestion if enabled
    let aiSuggestion: string | undefined;
    if (campground.aiEnabled && scoredSites.length > 0) {
      aiSuggestion = this.generateSuggestion(scoredSites, intent);
    }

    return {
      intent,
      results: scoredSites.slice(0, 20), // Limit to top 20 results
      totalMatches: scoredSites.length,
      aiSuggestion,
      fallbackUsed,
    };
  }

  /**
   * Fallback parsing when AI is not available
   */
  private fallbackParse(query: string): SearchIntent {
    const intent: SearchIntent = {
      confidence: 0.3,
      interpretedQuery: query,
    };

    const lowerQuery = query.toLowerCase();

    // Try to extract dates
    const datePatterns = [
      // ISO dates
      /(\d{4}-\d{2}-\d{2})/g,
      // US format
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      // Month name
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?/gi,
    ];

    // Try to extract site type
    if (/\brv\b|motor ?home|travel ?trailer|camper/i.test(lowerQuery)) {
      intent.siteType = "rv";
    } else if (/\btent\b|camping/i.test(lowerQuery)) {
      intent.siteType = "tent";
    } else if (/\bcabin\b/i.test(lowerQuery)) {
      intent.siteType = "cabin";
    } else if (/\bglamp/i.test(lowerQuery)) {
      intent.siteType = "glamping";
    }

    // Pet-friendly
    if (/\bpet\b|dog|cat/i.test(lowerQuery)) {
      intent.petFriendly = true;
    }

    // Price
    const priceMatch = lowerQuery.match(
      /under \$?(\d+)|less than \$?(\d+)|max(?:imum)? \$?(\d+)|budget.*\$?(\d+)/i,
    );
    if (priceMatch) {
      const price = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4]);
      intent.maxPricePerNight = price * 100; // Convert to cents
    }

    // Accessibility
    if (/\baccessib|ada|wheelchair/i.test(lowerQuery)) {
      intent.accessible = true;
    }

    // Waterfront
    if (/\bwater ?front|lake ?front|river|ocean|beach/i.test(lowerQuery)) {
      intent.waterfront = true;
    }

    // Hookups
    if (/\bfull hook ?ups?/i.test(lowerQuery)) {
      intent.hookups = { power: true, water: true, sewer: true };
    }

    // "Next weekend" handling
    if (/\bnext weekend\b/i.test(lowerQuery)) {
      const today = new Date();
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(today.getDate() + daysUntilSaturday);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);

      intent.arrivalDate = saturday.toISOString().split("T")[0];
      intent.departureDate = sunday.toISOString().split("T")[0];
      intent.confidence = 0.5;
    }

    // "This weekend"
    if (/\bthis weekend\b/i.test(lowerQuery)) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      let saturday: Date;

      if (dayOfWeek === 0) {
        // Sunday - use today
        saturday = new Date(today);
        saturday.setDate(today.getDate() - 1);
      } else if (dayOfWeek === 6) {
        // Saturday - use today
        saturday = today;
      } else {
        // Weekday - use upcoming Saturday
        saturday = new Date(today);
        saturday.setDate(today.getDate() + (6 - dayOfWeek));
      }

      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);

      intent.arrivalDate = saturday.toISOString().split("T")[0];
      intent.departureDate = sunday.toISOString().split("T")[0];
      intent.confidence = 0.5;
    }

    if (!intent.arrivalDate) {
      intent.clarificationNeeded =
        "When would you like to arrive? Please provide your check-in and check-out dates.";
    }

    return intent;
  }

  /**
   * Get available sites matching the search intent
   */
  private async getAvailableSites(
    campgroundId: string,
    campgroundSlug: string,
    intent: SearchIntent,
  ): Promise<AvailableSiteRow[]> {
    // Use raw SQL for performance - similar to public-reservations availability check
    const arrival = new Date(intent.arrivalDate!);
    const departure = new Date(intent.departureDate!);

    // Build filter conditions
    const filters: string[] = [`s."campgroundId" = '${campgroundId}'`, `s."isActive" = true`];

    if (intent.siteType) {
      const typeMapping: Record<string, string[]> = {
        rv: ["rv", "RV"],
        tent: ["tent", "Tent"],
        cabin: ["cabin", "Cabin", "lodging", "Lodging"],
        glamping: ["glamping", "Glamping"],
        lodging: ["lodging", "Lodging", "cabin", "Cabin"],
      };
      const types = typeMapping[intent.siteType] || [intent.siteType];
      filters.push(
        `(s."siteType" IN (${types.map((t) => `'${t}'`).join(",")}) OR sc."siteType" IN (${types.map((t) => `'${t}'`).join(",")}))`,
      );
    }

    if (intent.accessible) {
      filters.push(`(s."accessible" = true OR sc."accessible" = true)`);
    }

    if (intent.rigLength) {
      filters.push(
        `(s."rigMaxLength" IS NULL OR s."rigMaxLength" >= ${intent.rigLength} OR sc."rigMaxLength" >= ${intent.rigLength})`,
      );
    }

    // Query for available sites
    const sites = await this.prisma.$queryRawUnsafe<AvailableSiteRow[]>(`
      SELECT
        s.id,
        s.name,
        s."siteNumber",
        s."siteType",
        s."maxOccupancy",
        s."rigMaxLength",
        s."accessible",
        s."amenityTags",
        sc.id as "siteClassId",
        sc.name as "siteClassName",
        sc."defaultRate",
        sc."siteType" as "classSiteType",
        sc."petFriendly",
        sc."hookupsPower",
        sc."hookupsWater",
        sc."hookupsSewer",
        CASE
          WHEN EXISTS (
            SELECT 1 FROM "Reservation" r
            WHERE r."siteId" = s.id
              AND r.status != 'cancelled'
              AND r."arrivalDate" < '${departure.toISOString()}'::timestamp
              AND r."departureDate" > '${arrival.toISOString()}'::timestamp
          ) THEN 'booked'
          WHEN EXISTS (
            SELECT 1 FROM "MaintenanceTicket" mt
            WHERE mt."siteId" = s.id
              AND mt."isBlocking" = true
              AND mt.status != 'closed'
          ) THEN 'maintenance'
          WHEN EXISTS (
            SELECT 1 FROM "BlackoutDate" bd
            WHERE (bd."siteId" = s.id OR (bd."siteId" IS NULL AND bd."campgroundId" = s."campgroundId"))
              AND bd."startDate" <= '${departure.toISOString()}'::date
              AND bd."endDate" >= '${arrival.toISOString()}'::date
          ) THEN 'locked'
          ELSE 'available'
        END as status
      FROM "Site" s
      LEFT JOIN "SiteClass" sc ON s."siteClassId" = sc.id
      WHERE ${filters.join(" AND ")}
      ORDER BY sc."defaultRate" ASC, s."siteNumber" ASC
    `);

    return sites;
  }

  /**
   * Score sites based on how well they match the search intent
   */
  private scoreSites(sites: AvailableSiteRow[], intent: SearchIntent): NLSearchResult[] {
    return sites
      .map((site) => {
        let score = 50; // Base score
        const reasons: string[] = [];
        const maxOccupancy =
          typeof site.maxOccupancy === "number"
            ? site.maxOccupancy
            : Number(site.maxOccupancy) || 0;
        const rigMaxLength =
          typeof site.rigMaxLength === "number"
            ? site.rigMaxLength
            : Number(site.rigMaxLength) || 0;
        const pricePerNight = Number(site.defaultRate) || 0;
        const siteNumber = site.siteNumber ?? "";
        const siteName = site.name || siteNumber || "Site";
        const siteType = site.siteType || site.classSiteType || "Unknown";
        const siteClassId = site.siteClassId ?? "";
        const siteClassName = site.siteClassName ?? "Uncategorized";

        // Availability is most important
        if (site.status === "available") {
          score += 30;
          reasons.push("Available for your dates");
        } else {
          score -= 50;
          reasons.push(`Status: ${site.status}`);
        }

        // Site type match
        if (intent.siteType) {
          const normalizedType = siteType.toLowerCase();
          if (normalizedType.includes(intent.siteType)) {
            score += 10;
            reasons.push(`Matches ${intent.siteType} preference`);
          }
        }

        // Pet-friendly
        if (intent.petFriendly && site.petFriendly) {
          score += 10;
          reasons.push("Pet-friendly");
        }

        // Accessibility
        if (intent.accessible && site.accessible) {
          score += 10;
          reasons.push("Accessible");
        }

        // Hookups
        if (intent.hookups) {
          let hookupScore = 0;
          if (intent.hookups.power && site.hookupsPower) hookupScore += 3;
          if (intent.hookups.water && site.hookupsWater) hookupScore += 3;
          if (intent.hookups.sewer && site.hookupsSewer) hookupScore += 4;
          if (hookupScore > 0) {
            score += hookupScore;
            reasons.push("Has requested hookups");
          }
        }

        // Price constraint
        if (intent.maxPricePerNight && pricePerNight <= intent.maxPricePerNight) {
          score += 5;
          reasons.push(`Within budget ($${(pricePerNight / 100).toFixed(2)}/night)`);
        } else if (intent.maxPricePerNight && pricePerNight > intent.maxPricePerNight) {
          score -= 10;
          reasons.push(`Over budget ($${(pricePerNight / 100).toFixed(2)}/night)`);
        }

        // Capacity
        if (intent.adults || intent.children) {
          const totalGuests = (intent.adults || 0) + (intent.children || 0);
          if (maxOccupancy >= totalGuests) {
            score += 5;
            reasons.push(`Fits ${totalGuests} guests`);
          } else {
            score -= 20;
            reasons.push(`Max occupancy: ${maxOccupancy}`);
          }
        }

        // Rig length
        if (intent.rigLength && rigMaxLength) {
          if (rigMaxLength >= intent.rigLength) {
            score += 5;
            reasons.push(`Fits ${intent.rigLength}ft rig`);
          } else {
            score -= 30;
            reasons.push(`Max rig length: ${rigMaxLength}ft`);
          }
        }

        // Calculate nights for total price
        const nights =
          intent.nights || this.calculateNights(intent.arrivalDate!, intent.departureDate!);

        return {
          siteId: site.id,
          siteName,
          siteNumber,
          siteType,
          siteClass: {
            id: siteClassId,
            name: siteClassName,
            defaultRate: pricePerNight,
          },
          status: site.status,
          matchScore: Math.max(0, Math.min(100, score)),
          matchReasons: reasons,
          pricePerNight,
          totalPrice: pricePerNight * nights,
          amenities: site.amenityTags || [],
        };
      })
      .filter((site) => site.status === "available" || site.matchScore > 30)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Generate a helpful suggestion based on results
   */
  private generateSuggestion(results: NLSearchResult[], intent: SearchIntent): string {
    if (results.length === 0) {
      return "No sites match your criteria. Try adjusting your dates or preferences.";
    }

    const topResult = results[0];
    const availableCount = results.filter((r) => r.status === "available").length;

    if (availableCount === 0) {
      return "All sites are currently booked for these dates. Consider checking nearby dates or joining the waitlist.";
    }

    if (intent.petFriendly && !topResult.matchReasons.some((r) => r.includes("Pet"))) {
      return `We found ${availableCount} available sites. Note: Some may have pet restrictions. Contact us for pet-friendly options.`;
    }

    if (topResult.matchScore >= 80) {
      return `Great match! ${topResult.siteName} meets all your preferences at $${(topResult.pricePerNight! / 100).toFixed(2)}/night.`;
    }

    return `Found ${availableCount} available sites for your dates. ${topResult.siteName} is our top recommendation.`;
  }

  /**
   * Calculate nights between two dates
   */
  private calculateNights(arrival: string, departure: string): number {
    const a = new Date(arrival);
    const d = new Date(departure);
    const diff = d.getTime() - a.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Parse AI response JSON
   */
  private parseAiResponse(content: string): SearchIntent {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadGatewayException("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      arrivalDate: parsed.arrivalDate || undefined,
      departureDate: parsed.departureDate || undefined,
      nights: parsed.nights || undefined,
      flexible: parsed.flexible || false,
      siteType: parsed.siteType || undefined,
      rigType: parsed.rigType || undefined,
      rigLength: parsed.rigLength || undefined,
      amenities: parsed.amenities || [],
      petFriendly: parsed.petFriendly || undefined,
      waterfront: parsed.waterfront || undefined,
      hookups: parsed.hookups || undefined,
      accessible: parsed.accessible || undefined,
      adults: parsed.adults || undefined,
      children: parsed.children || undefined,
      pets: parsed.pets || undefined,
      maxPricePerNight: parsed.maxPricePerNight || undefined,
      minPricePerNight: parsed.minPricePerNight || undefined,
      quiet: parsed.quiet || undefined,
      nearAmenities: parsed.nearAmenities || undefined,
      confidence: parsed.confidence || 0.5,
      clarificationNeeded: parsed.clarificationNeeded || undefined,
      interpretedQuery: parsed.interpretedQuery || undefined,
    };
  }
}
