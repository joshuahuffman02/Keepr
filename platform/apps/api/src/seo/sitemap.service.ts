import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampgroundClaimStatus } from "@prisma/client";

/**
 * Sitemap Service
 *
 * Generates XML sitemaps for SEO:
 * - Campground pages
 * - Location pages (states, cities)
 * - Attraction pages (national parks, lakes)
 * - Software/comparison pages
 * - Sitemap index for all sub-sitemaps
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private readonly baseUrl: string;
  private readonly sitemapCacheTtl = 60 * 60 * 1000; // 1 hour

  // Simple in-memory cache for sitemaps
  private cache: Map<string, { data: string; timestamp: number }> = new Map();

  constructor(private readonly prisma: PrismaService) {
    this.baseUrl = process.env.PUBLIC_URL || "https://campeveryday.com";
  }

  /**
   * Generate sitemap index listing all sub-sitemaps
   */
  async generateSitemapIndex(): Promise<string> {
    const sitemaps = [
      { loc: `${this.baseUrl}/sitemap-campgrounds.xml` },
      { loc: `${this.baseUrl}/sitemap-locations.xml` },
      { loc: `${this.baseUrl}/sitemap-attractions.xml` },
      { loc: `${this.baseUrl}/sitemap-software.xml` },
      { loc: `${this.baseUrl}/sitemap-pages.xml` },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const sitemap of sitemaps) {
      xml += "  <sitemap>\n";
      xml += `    <loc>${sitemap.loc}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
      xml += "  </sitemap>\n";
    }

    xml += "</sitemapindex>";
    return xml;
  }

  /**
   * Generate sitemap for campground pages
   */
  async generateCampgroundsSitemap(): Promise<string> {
    const cached = this.getFromCache("campgrounds");
    if (cached) return cached;

    const campgrounds = await this.prisma.campground.findMany({
      where: {
        deletedAt: null,
        // Include both claimed and unclaimed (for claim pages)
      },
      select: {
        slug: true,
        updatedAt: true,
        claimStatus: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const urls: SitemapUrl[] = campgrounds.map((c) => ({
      loc: `${this.baseUrl}/campground/${c.slug}`,
      lastmod: c.updatedAt.toISOString(),
      changefreq: c.claimStatus === CampgroundClaimStatus.claimed ? "weekly" : "monthly",
      priority: c.claimStatus === CampgroundClaimStatus.claimed ? 0.8 : 0.5,
    }));

    const xml = this.generateSitemapXml(urls);
    this.setCache("campgrounds", xml);
    return xml;
  }

  /**
   * Generate sitemap for location pages (states, cities)
   */
  async generateLocationsSitemap(): Promise<string> {
    const cached = this.getFromCache("locations");
    if (cached) return cached;

    const locations = await this.prisma.seoLocation.findMany({
      where: {
        isPublished: true,
        campgroundCount: { gt: 0 },
      },
      select: {
        slug: true,
        type: true,
        statsUpdatedAt: true,
      },
      orderBy: { campgroundCount: "desc" },
    });

    const urls: SitemapUrl[] = locations.map((l) => {
      // State pages are higher priority
      const priority = l.type === "state" ? 0.9 : 0.7;
      const changefreq = l.type === "state" ? "weekly" : "monthly";

      return {
        loc: `${this.baseUrl}/camping/${l.slug}`,
        lastmod: l.statsUpdatedAt?.toISOString(),
        changefreq,
        priority,
      };
    });

    const xml = this.generateSitemapXml(urls);
    this.setCache("locations", xml);
    return xml;
  }

  /**
   * Generate sitemap for attraction pages
   */
  async generateAttractionsSitemap(): Promise<string> {
    const cached = this.getFromCache("attractions");
    if (cached) return cached;

    const attractions = await this.prisma.attraction.findMany({
      where: {
        isPublished: true,
        nearbyCampgroundCount: { gt: 0 },
      },
      select: {
        slug: true,
        type: true,
        statsUpdatedAt: true,
      },
      orderBy: { nearbyCampgroundCount: "desc" },
    });

    const urls: SitemapUrl[] = attractions.map((a) => {
      // National parks are higher priority
      const priority = a.type === "national_park" ? 0.9 : 0.7;

      return {
        loc: `${this.baseUrl}/near/${a.slug}`,
        lastmod: a.statsUpdatedAt?.toISOString(),
        changefreq: "monthly",
        priority,
      };
    });

    const xml = this.generateSitemapXml(urls);
    this.setCache("attractions", xml);
    return xml;
  }

  /**
   * Generate sitemap for software pages
   */
  async generateSoftwareSitemap(): Promise<string> {
    const cached = this.getFromCache("software");
    if (cached) return cached;

    const softwarePages = await this.prisma.softwarePage.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        pageType: true,
        publishedAt: true,
      },
    });

    const urls: SitemapUrl[] = softwarePages.map((p) => ({
      loc: `${this.baseUrl}/software/${p.slug}`,
      lastmod: p.publishedAt?.toISOString(),
      changefreq: "monthly",
      priority: p.pageType === "competitor_comparison" ? 0.8 : 0.7,
    }));

    // Add static software pages
    urls.push(
      {
        loc: `${this.baseUrl}/compare`,
        changefreq: "weekly",
        priority: 0.9,
      },
      {
        loc: `${this.baseUrl}/features`,
        changefreq: "weekly",
        priority: 0.9,
      },
      {
        loc: `${this.baseUrl}/pricing`,
        changefreq: "weekly",
        priority: 0.9,
      }
    );

    const xml = this.generateSitemapXml(urls);
    this.setCache("software", xml);
    return xml;
  }

  /**
   * Generate sitemap for static pages
   */
  async generatePagesSitemap(): Promise<string> {
    const cached = this.getFromCache("pages");
    if (cached) return cached;

    const urls: SitemapUrl[] = [
      // Main pages
      { loc: `${this.baseUrl}/`, changefreq: "daily", priority: 1.0 },
      { loc: `${this.baseUrl}/about`, changefreq: "monthly", priority: 0.6 },
      { loc: `${this.baseUrl}/contact`, changefreq: "monthly", priority: 0.5 },
      { loc: `${this.baseUrl}/demo`, changefreq: "weekly", priority: 0.9 },
      { loc: `${this.baseUrl}/sign-up`, changefreq: "monthly", priority: 0.8 },

      // Discovery pages
      { loc: `${this.baseUrl}/camping`, changefreq: "weekly", priority: 0.9 },
      { loc: `${this.baseUrl}/national-parks`, changefreq: "weekly", priority: 0.8 },
      { loc: `${this.baseUrl}/states`, changefreq: "weekly", priority: 0.8 },

      // Operator pages
      { loc: `${this.baseUrl}/claim-your-listing`, changefreq: "monthly", priority: 0.7 },
      { loc: `${this.baseUrl}/for-campgrounds`, changefreq: "monthly", priority: 0.8 },
      { loc: `${this.baseUrl}/for-rv-parks`, changefreq: "monthly", priority: 0.8 },

      // Legal
      { loc: `${this.baseUrl}/privacy`, changefreq: "yearly", priority: 0.3 },
      { loc: `${this.baseUrl}/terms`, changefreq: "yearly", priority: 0.3 },
    ];

    const xml = this.generateSitemapXml(urls);
    this.setCache("pages", xml);
    return xml;
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt(): string {
    return `# robots.txt for ${this.baseUrl}
User-agent: *
Allow: /

# Sitemaps
Sitemap: ${this.baseUrl}/sitemap.xml

# Disallow admin and private paths
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/
Disallow: /auth/
Disallow: /_next/
Disallow: /account/

# Disallow search with parameters (avoid duplicate content)
Disallow: /*?*

# Allow specific query params for filtering
Allow: /camping/*?sortBy=
Allow: /near/*?sortBy=
`;
  }

  /**
   * Clear all cached sitemaps
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log("Sitemap cache cleared");
  }

  /**
   * Generate XML from URL list
   */
  private generateSitemapXml(urls: SitemapUrl[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const url of urls) {
      xml += "  <url>\n";
      xml += `    <loc>${this.escapeXml(url.loc)}</loc>\n`;
      if (url.lastmod) {
        xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }
      if (url.changefreq) {
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }
      if (url.priority !== undefined) {
        xml += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      }
      xml += "  </url>\n";
    }

    xml += "</urlset>";
    return xml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private getFromCache(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.sitemapCacheTtl) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: string): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
