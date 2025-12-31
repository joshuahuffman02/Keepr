import { Injectable, Logger } from "@nestjs/common";

/**
 * Recreation.gov API integration for fetching federal campground data.
 *
 * Recreation.gov provides data for:
 * - National Parks Service (NPS)
 * - US Forest Service (USFS)
 * - Bureau of Land Management (BLM)
 * - Army Corps of Engineers
 * - Bureau of Reclamation
 * - Fish and Wildlife Service
 *
 * API Docs: https://ridb.recreation.gov/docs
 * Note: Requires API key from Recreation.gov developer portal
 */

export interface RecreationGovFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityDescription: string;
  FacilityTypeDescription: string;
  FacilityUseFeeDescription: string;
  FacilityDirections: string;
  FacilityPhone: string;
  FacilityEmail: string;
  FacilityReservationURL: string;
  FacilityMapURL: string;
  FacilityAdaAccess: string;
  FacilityLongitude: number;
  FacilityLatitude: number;
  Keywords: string;
  StayLimit: string;
  Reservable: boolean;
  Enabled: boolean;
  LastUpdatedDate: string;
  GEOJSON: {
    TYPE: string;
    COORDINATES: [number, number];
  };
  // Address info
  FACILITYADDRESS: Array<{
    FacilityAddressID: string;
    FacilityID: string;
    FacilityAddressType: string;
    FacilityStreetAddress1: string;
    FacilityStreetAddress2: string;
    FacilityStreetAddress3: string;
    City: string;
    PostalCode: string;
    AddressStateCode: string;
    AddressCountryCode: string;
    LastUpdatedDate: string;
  }>;
  // Media
  MEDIA: Array<{
    EntityMediaID: string;
    MediaType: string;
    EntityID: string;
    EntityType: string;
    Title: string;
    Subtitle: string;
    Description: string;
    EmbedCode: string;
    Height: number;
    Width: number;
    URL: string;
    Credits: string;
  }>;
  // Recreation areas this facility belongs to
  RECAREA: Array<{
    RecAreaID: string;
    RecAreaName: string;
    RecAreaDescription: string;
  }>;
  // Organization managing this facility
  ORGANIZATION: Array<{
    OrgID: string;
    OrgName: string;
    OrgAbbrevName: string;
    OrgType: string;
    OrgURLText: string;
    OrgURLAddress: string;
  }>;
  // Activities available
  ACTIVITY: Array<{
    ActivityID: number;
    ActivityParentID: number;
    ActivityName: string;
    FacilityActivityDescription: string;
    FacilityActivityFeeDescription: string;
  }>;
  // Campsite types available
  CAMPSITE: Array<{
    CampsiteID: string;
    CampsiteName: string;
    CampsiteType: string;
    TypeOfUse: string;
    Loop: string;
    CampsiteAccessible: boolean;
    CampsiteLongitude: number;
    CampsiteLatitude: number;
    CreatedDate: string;
    LastUpdatedDate: string;
    ATTRIBUTES: Array<{
      AttributeID: number;
      AttributeName: string;
      AttributeValue: string;
    }>;
    PERMITTEDEQUIPMENT: Array<{
      EquipmentName: string;
      MaxLength: number;
    }>;
  }>;
}

export interface RecreationGovSearchParams {
  query?: string;
  state?: string;
  limit?: number;
  offset?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  activity?: string;
  lastupdated?: string;
}

export interface RecreationGovSearchResult {
  RECDATA: RecreationGovFacility[];
  METADATA: {
    RESULTS: {
      CURRENT_COUNT: number;
      TOTAL_COUNT: number;
    };
    SEARCH_PARAMETERS: {
      QUERY: string;
      LIMIT: number;
      OFFSET: number;
    };
  };
}

@Injectable()
export class RecreationGovService {
  private readonly logger = new Logger(RecreationGovService.name);
  private readonly baseUrl = "https://ridb.recreation.gov/api/v1";
  private readonly apiKey = process.env.RECREATION_GOV_API_KEY;

  /**
   * Search for facilities (campgrounds) on Recreation.gov
   */
  async searchFacilities(
    params: RecreationGovSearchParams = {}
  ): Promise<RecreationGovSearchResult> {
    if (!this.apiKey) {
      this.logger.warn(
        "RECREATION_GOV_API_KEY not set. Using mock data for development."
      );
      return this.getMockSearchResult();
    }

    const searchParams = new URLSearchParams();

    if (params.query) searchParams.set("query", params.query);
    if (params.state) searchParams.set("state", params.state);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));
    if (params.latitude) searchParams.set("latitude", String(params.latitude));
    if (params.longitude)
      searchParams.set("longitude", String(params.longitude));
    if (params.radius) searchParams.set("radius", String(params.radius));
    if (params.activity) searchParams.set("activity", params.activity);
    if (params.lastupdated)
      searchParams.set("lastupdated", params.lastupdated);

    // Only include facility types that are campgrounds
    searchParams.set("facilitytype", "camping");

    const url = `${this.baseUrl}/facilities?${searchParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          apikey: this.apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Recreation.gov API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch from Recreation.gov: ${error}`);
      throw error;
    }
  }

  /**
   * Get a single facility by ID with full details
   */
  async getFacility(facilityId: string): Promise<RecreationGovFacility | null> {
    if (!this.apiKey) {
      this.logger.warn("RECREATION_GOV_API_KEY not set");
      return null;
    }

    const url = `${this.baseUrl}/facilities/${facilityId}?full=true`;

    try {
      const response = await fetch(url, {
        headers: {
          apikey: this.apiKey,
          Accept: "application/json",
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `Recreation.gov API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch facility ${facilityId} from Recreation.gov: ${error}`
      );
      throw error;
    }
  }

  /**
   * Fetch all campgrounds for a given state
   */
  async getCampgroundsByState(
    stateCode: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<RecreationGovFacility[]> {
    const allFacilities: RecreationGovFacility[] = [];
    const pageSize = 50;
    let offset = 0;
    let totalCount = 0;

    do {
      const result = await this.searchFacilities({
        state: stateCode,
        limit: pageSize,
        offset,
      });

      allFacilities.push(...result.RECDATA);
      totalCount = result.METADATA.RESULTS.TOTAL_COUNT;
      offset += pageSize;

      if (onProgress) {
        onProgress(allFacilities.length, totalCount);
      }

      // Rate limit: 1000 requests per hour = ~1 request per 3.6 seconds
      // Being conservative with 500ms delay
      await this.sleep(500);
    } while (offset < totalCount);

    return allFacilities;
  }

  /**
   * Fetch all campgrounds nationwide (with pagination and rate limiting)
   */
  async getAllCampgrounds(
    onProgress?: (
      processed: number,
      total: number,
      currentState: string
    ) => void
  ): Promise<RecreationGovFacility[]> {
    const states = [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
    ];

    const allFacilities: RecreationGovFacility[] = [];
    let totalProcessed = 0;

    for (const state of states) {
      this.logger.log(`Fetching campgrounds for state: ${state}`);

      try {
        const stateFacilities = await this.getCampgroundsByState(state);
        allFacilities.push(...stateFacilities);
        totalProcessed += stateFacilities.length;

        if (onProgress) {
          onProgress(totalProcessed, -1, state);
        }

        this.logger.log(
          `Found ${stateFacilities.length} campgrounds in ${state}. Total: ${totalProcessed}`
        );
      } catch (error) {
        this.logger.error(`Failed to fetch campgrounds for ${state}: ${error}`);
        // Continue with next state
      }

      // Rate limit between states
      await this.sleep(1000);
    }

    return allFacilities;
  }

  /**
   * Convert Recreation.gov facility to our campground format
   */
  mapFacilityToCampground(
    facility: RecreationGovFacility,
    organizationId: string
  ): {
    name: string;
    slug: string;
    city?: string;
    state?: string;
    country: string;
    address1?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    email?: string;
    website?: string;
    description?: string;
    amenities: string[];
    photos: string[];
    heroImageUrl?: string;
    seededDataSource: "recreation_gov";
    seededDataSourceId: string;
    isExternal: boolean;
    isBookable: boolean;
    externalUrl?: string;
  } {
    const address = facility.FACILITYADDRESS?.[0];
    const photos = facility.MEDIA?.filter((m) => m.MediaType === "Image").map(
      (m) => m.URL
    ) || [];
    const activities =
      facility.ACTIVITY?.map((a) => a.ActivityName.toLowerCase()) || [];

    // Extract amenities from activities and facility type
    const amenities = this.extractAmenities(activities, facility);

    // Generate URL-safe slug
    const slug = this.generateSlug(facility.FacilityName, facility.FacilityID);

    return {
      name: facility.FacilityName,
      slug,
      city: address?.City,
      state: address?.AddressStateCode,
      country: address?.AddressCountryCode || "USA",
      address1: address?.FacilityStreetAddress1,
      postalCode: address?.PostalCode,
      latitude: facility.FacilityLatitude,
      longitude: facility.FacilityLongitude,
      phone: facility.FacilityPhone,
      email: facility.FacilityEmail,
      website: facility.FacilityReservationURL,
      description: this.cleanDescription(facility.FacilityDescription),
      amenities,
      photos,
      heroImageUrl: photos[0],
      seededDataSource: "recreation_gov",
      seededDataSourceId: facility.FacilityID,
      isExternal: true,
      isBookable: facility.Reservable,
      externalUrl: facility.FacilityReservationURL,
    };
  }

  private extractAmenities(
    activities: string[],
    facility: RecreationGovFacility
  ): string[] {
    const amenities: string[] = [];

    // Map activities to amenities
    const activityAmenityMap: Record<string, string> = {
      camping: "Camping",
      hiking: "Hiking Trails",
      fishing: "Fishing",
      boating: "Boating",
      swimming: "Swimming",
      biking: "Biking",
      "horse camping": "Horse Camping",
      "wildlife viewing": "Wildlife Viewing",
      "rock climbing": "Rock Climbing",
      kayaking: "Kayaking",
      canoeing: "Canoeing",
      "off roading": "Off-Road Trails",
      "nature viewing": "Nature Viewing",
    };

    for (const activity of activities) {
      const lowered = activity.toLowerCase();
      for (const [key, value] of Object.entries(activityAmenityMap)) {
        if (lowered.includes(key)) {
          amenities.push(value);
        }
      }
    }

    // Check for ADA accessibility
    if (
      facility.FacilityAdaAccess &&
      facility.FacilityAdaAccess !== "N" &&
      facility.FacilityAdaAccess !== "No"
    ) {
      amenities.push("ADA Accessible");
    }

    // Check campsite attributes for RV hookups
    const hasElectric = facility.CAMPSITE?.some((site) =>
      site.ATTRIBUTES?.some(
        (attr) =>
          attr.AttributeName.toLowerCase().includes("electric") &&
          attr.AttributeValue !== "No"
      )
    );
    if (hasElectric) amenities.push("Electric Hookups");

    const hasWater = facility.CAMPSITE?.some((site) =>
      site.ATTRIBUTES?.some(
        (attr) =>
          attr.AttributeName.toLowerCase().includes("water hookup") &&
          attr.AttributeValue !== "No"
      )
    );
    if (hasWater) amenities.push("Water Hookups");

    const hasSewer = facility.CAMPSITE?.some((site) =>
      site.ATTRIBUTES?.some(
        (attr) =>
          attr.AttributeName.toLowerCase().includes("sewer") &&
          attr.AttributeValue !== "No"
      )
    );
    if (hasSewer) amenities.push("Sewer Hookups");

    return [...new Set(amenities)]; // Remove duplicates
  }

  private generateSlug(name: string, id: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80);

    // Add a portion of the ID for uniqueness
    const shortId = id.substring(0, 6);
    return `${baseSlug}-${shortId}`;
  }

  private cleanDescription(description: string): string {
    if (!description) return "";

    // Remove HTML tags
    let clean = description.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    clean = clean
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    // Clean up whitespace
    clean = clean.replace(/\s+/g, " ").trim();

    return clean;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mock data for development when API key is not available
   */
  private getMockSearchResult(): RecreationGovSearchResult {
    return {
      RECDATA: [],
      METADATA: {
        RESULTS: {
          CURRENT_COUNT: 0,
          TOTAL_COUNT: 0,
        },
        SEARCH_PARAMETERS: {
          QUERY: "",
          LIMIT: 50,
          OFFSET: 0,
        },
      },
    };
  }
}
