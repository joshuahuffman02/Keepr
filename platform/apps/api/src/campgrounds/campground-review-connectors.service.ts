import { Injectable, Logger } from "@nestjs/common";

type ExternalReview = {
  rating?: number | null;
  count?: number | null;
  source: string;
  reviews?: any[];
};

@Injectable()
export class CampgroundReviewConnectors {
  private readonly logger = new Logger(CampgroundReviewConnectors.name);

  private async fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
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

    const fields = [
      "rating",
      "user_ratings_total",
      "reviews",
      "url"
    ].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=${fields}&reviews_sort=newest&language=en&key=${apiKey}`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(`Google Places fetch failed status=${res.status}`);
        return { source: "google_places", rating: null, count: null, reviews: [] };
      }
      const json = await res.json();
      if (json?.status && json.status !== "OK") {
        this.logger.warn(`Google Places response status=${json.status}`);
      }
      const result = json?.result ?? {};
      const rating = result.rating ?? null;
      const count = result.user_ratings_total ?? null;
      const reviews = Array.isArray(result.reviews)
        ? result.reviews.slice(0, 10).map((r: any) => ({
            author: r.author_name,
            rating: r.rating,
            text: r.text,
            time: r.time,
            relativeTime: r.relative_time_description,
            profilePhotoUrl: r.profile_photo_url
          }))
        : [];
      return { source: "google_places", rating, count, reviews };
    } catch (err: any) {
      this.logger.error(`Google Places fetch error: ${err?.message || err}`);
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
      this.logger.debug(`RV Life API not configured (missing RV_LIFE_API_KEY) for parkId=${parkId}`);
      return { source: "rv_life", rating: null, count: null, reviews: [] };
    }

    // TODO: Implement actual API call once credentials and documentation are available
    this.logger.warn(`RV Life API integration pending - credentials configured but implementation incomplete for parkId=${parkId}`);

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
    } catch (err: any) {
      this.logger.error(`RV Life API error: ${err?.message || err}`);
      return { source: "rv_life", rating: null, count: null, reviews: [] };
    }
  }

  /**
   * Parse RV Life API response
   * TODO: Implement based on actual API response format
   */
  private parseRvLifeResponse(data: any): ExternalReview {
    // This will need to be implemented based on RV Life's actual response format
    return {
      source: "rv_life",
      rating: data?.rating ?? null,
      count: data?.review_count ?? null,
      reviews: Array.isArray(data?.reviews)
        ? data.reviews.slice(0, 10).map((r: any) => ({
            author: r.author_name,
            rating: r.rating,
            text: r.review_text,
            date: r.created_at,
          }))
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

