import { Injectable, Logger } from "@nestjs/common";

type ExternalReviewItem = {
  author?: string | null;
  rating?: number | null;
  text?: string | null;
  time?: number | null;
  relativeTime?: string | null;
  profilePhotoUrl?: string | null;
  date?: string | null;
};

type ExternalReview = {
  rating?: number | null;
  count?: number | null;
  source: string;
  reviews?: ExternalReviewItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const parseGoogleReview = (review: unknown): ExternalReviewItem | null => {
  if (!isRecord(review)) return null;
  return {
    author: typeof review.author_name === "string" ? review.author_name : null,
    rating: typeof review.rating === "number" ? review.rating : null,
    text: typeof review.text === "string" ? review.text : null,
    time: typeof review.time === "number" ? review.time : null,
    relativeTime:
      typeof review.relative_time_description === "string"
        ? review.relative_time_description
        : null,
    profilePhotoUrl: typeof review.profile_photo_url === "string" ? review.profile_photo_url : null,
  };
};

const parseRvLifeReview = (review: unknown): ExternalReviewItem | null => {
  if (!isRecord(review)) return null;
  return {
    author: typeof review.author_name === "string" ? review.author_name : null,
    rating: typeof review.rating === "number" ? review.rating : null,
    text: typeof review.review_text === "string" ? review.review_text : null,
    date: typeof review.created_at === "string" ? review.created_at : null,
  };
};

@Injectable()
export class CampgroundReviewConnectors {
  private readonly logger = new Logger(CampgroundReviewConnectors.name);

  private async fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    id.unref?.();
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  async fetchGoogleReviews(placeId?: string): Promise<ExternalReview | null> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey || !placeId) return null;

    const fields = ["rating", "user_ratings_total", "reviews", "url"].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId,
    )}&fields=${fields}&reviews_sort=newest&language=en&key=${apiKey}`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(`Google Places fetch failed status=${res.status}`);
        return { source: "google_places", rating: null, count: null, reviews: [] };
      }
      const json = await res.json();
      if (isRecord(json) && typeof json.status === "string" && json.status !== "OK") {
        this.logger.warn(`Google Places response status=${json.status}`);
      }
      const result = isRecord(json) && isRecord(json.result) ? json.result : {};
      const rating = typeof result.rating === "number" ? result.rating : null;
      const count =
        typeof result.user_ratings_total === "number" ? result.user_ratings_total : null;
      const reviews = Array.isArray(result.reviews)
        ? result.reviews.slice(0, 10).reduce<ExternalReviewItem[]>((acc, review) => {
            const parsed = parseGoogleReview(review);
            if (parsed) acc.push(parsed);
            return acc;
          }, [])
        : [];
      return { source: "google_places", rating, count, reviews };
    } catch (err) {
      this.logger.error(`Google Places fetch error: ${getErrorMessage(err)}`);
      return { source: "google_places", rating: null, count: null, reviews: [] };
    }
  }

  /**
   * Fetch reviews from RV Life API
   *
   * TODO: Complete RV Life API integration
   *
   * Required environment variables:
   * - RV_LIFE_API_KEY: Your RV Life API key
   * - RV_LIFE_API_URL: Base URL (default: https://api.rvlife.com/v1)
   *
   * API Documentation: Contact RV Life for API access
   * Rate Limits: Unknown - implement rate limiting when credentials are obtained
   *
   * Integration steps:
   * 1. Obtain API credentials from RV Life
   * 2. Set environment variables
   * 3. Implement authentication (likely Bearer token)
   * 4. Map RV Life park IDs to campground records
   * 5. Parse response format (structure unknown until API access)
   * 6. Handle errors and rate limiting
   *
   * Example implementation structure:
   * const apiKey = process.env.RV_LIFE_API_KEY;
   * const baseUrl = process.env.RV_LIFE_API_URL || 'https://api.rvlife.com/v1';
   * const url = `${baseUrl}/campgrounds/${parkId}/reviews`;
   * const response = await fetch(url, {
   *   headers: { 'Authorization': `Bearer ${apiKey}` }
   * });
   */
  async fetchRvLifeReviews(parkId?: string): Promise<ExternalReview | null> {
    if (!parkId) return null;

    const apiKey = process.env.RV_LIFE_API_KEY;

    // Return empty if API not configured
    if (!apiKey) {
      this.logger.debug(
        `RV Life API not configured (missing RV_LIFE_API_KEY) for parkId=${parkId}`,
      );
      return { source: "rv_life", rating: null, count: null, reviews: [] };
    }

    // TODO: Implement actual API call once credentials and documentation are available
    this.logger.warn(
      `RV Life API integration pending - credentials configured but implementation incomplete for parkId=${parkId}`,
    );

    try {
      // Placeholder for future implementation:
      // const baseUrl = process.env.RV_LIFE_API_URL || 'https://api.rvlife.com/v1';
      // const url = `${baseUrl}/campgrounds/${encodeURIComponent(parkId)}/reviews`;
      // const response = await this.fetchWithTimeout(url);
      // if (!response.ok) {
      //   this.logger.warn(`RV Life API fetch failed status=${response.status}`);
      //   return { source: "rv_life", rating: null, count: null, reviews: [] };
      // }
      // const data = await response.json();
      // return this.parseRvLifeResponse(data);

      return { source: "rv_life", rating: null, count: null, reviews: [] };
    } catch (err) {
      this.logger.error(`RV Life API error: ${getErrorMessage(err)}`);
      return { source: "rv_life", rating: null, count: null, reviews: [] };
    }
  }

  /**
   * Parse RV Life API response
   * TODO: Implement based on actual API response format
   */
  private parseRvLifeResponse(data: unknown): ExternalReview {
    if (!isRecord(data)) {
      return { source: "rv_life", rating: null, count: null, reviews: [] };
    }
    // This will need to be implemented based on RV Life's actual response format
    return {
      source: "rv_life",
      rating: typeof data.rating === "number" ? data.rating : null,
      count: typeof data.review_count === "number" ? data.review_count : null,
      reviews: Array.isArray(data.reviews)
        ? data.reviews.slice(0, 10).reduce<ExternalReviewItem[]>((acc, review) => {
            const parsed = parseRvLifeReview(review);
            if (parsed) acc.push(parsed);
            return acc;
          }, [])
        : [],
    };
  }

  async collectExternalReviews(opts: { googlePlaceId?: string; rvLifeId?: string }) {
    const results: ExternalReview[] = [];
    const google = await this.fetchGoogleReviews(opts.googlePlaceId);
    if (google) results.push(google);
    const rvLife = await this.fetchRvLifeReviews(opts.rvLifeId);
    if (rvLife) results.push(rvLife);
    return results;
  }
}
