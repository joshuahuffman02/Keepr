import { MetadataRoute } from "next";
import { apiClient } from "@/lib/api-client";
import { STATIC_PAGES, getBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

/**
 * Dynamic sitemap generation for SEO
 * Includes: static pages, campgrounds, and location-based pages for programmatic SEO
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Static pages
  const staticUrls: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  try {
    const campgrounds = await apiClient.getPublicCampgrounds();

    // Individual campground pages
    const campgroundUrls: MetadataRoute.Sitemap = campgrounds.map((campground) => ({
      url: `${baseUrl}/park/${campground.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    // Campground booking pages (high-intent pages)
    const bookingUrls: MetadataRoute.Sitemap = campgrounds.map((campground) => ({
      url: `${baseUrl}/park/${campground.slug}/book`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    // Generate location-based pages for programmatic SEO (state-level)
    const stateMap = new Map<string, { count: number; lastModified: Date }>();
    campgrounds.forEach((cg) => {
      if (cg.state) {
        const existing = stateMap.get(cg.state);
        stateMap.set(cg.state, {
          count: (existing?.count || 0) + 1,
          lastModified: now,
        });
      }
    });

    const stateUrls: MetadataRoute.Sitemap = Array.from(stateMap.entries())
      .filter(([, data]) => data.count >= 1) // Include states with at least 1 campground
      .map(([state, data]) => ({
        url: `${baseUrl}/browse/${state.toLowerCase().replace(/\s+/g, "-")}`,
        lastModified: data.lastModified,
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    // Generate city-level pages for larger metros
    const cityMap = new Map<string, { state: string; count: number; lastModified: Date }>();
    campgrounds.forEach((cg) => {
      if (cg.city && cg.state) {
        const key = `${cg.city}-${cg.state}`;
        const existing = cityMap.get(key);
        cityMap.set(key, {
          state: cg.state,
          count: (existing?.count || 0) + 1,
          lastModified: now,
        });
      }
    });

    const cityUrls: MetadataRoute.Sitemap = Array.from(cityMap.entries())
      .filter(([, data]) => data.count >= 2) // Only cities with 2+ campgrounds
      .map(([cityState, data]) => {
        const [city] = cityState.split("-");
        const slug = `${city.toLowerCase().replace(/\s+/g, "-")}-${data.state.toLowerCase().replace(/\s+/g, "-")}`;
        return {
          url: `${baseUrl}/browse/${slug}`,
          lastModified: data.lastModified,
          changeFrequency: "weekly",
          priority: 0.5,
        };
      });

    return [...staticUrls, ...campgroundUrls, ...bookingUrls, ...stateUrls, ...cityUrls];
  } catch {
    // Fallback to static pages only if API fails
    return staticUrls;
  }
}
