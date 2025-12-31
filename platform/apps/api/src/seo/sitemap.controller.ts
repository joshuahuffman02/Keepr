import { Controller, Get, Header, Post, UseGuards } from "@nestjs/common";
import { SitemapService } from "./sitemap.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole } from "@prisma/client";

/**
 * Sitemap Controller
 *
 * Public endpoints for search engine crawlers:
 * - /sitemap.xml - Sitemap index
 * - /sitemap-campgrounds.xml - Campground pages
 * - /sitemap-locations.xml - Location pages
 * - /sitemap-attractions.xml - Attraction pages
 * - /sitemap-software.xml - Software/comparison pages
 * - /sitemap-pages.xml - Static pages
 * - /robots.txt - Crawler instructions
 */

@Controller()
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * Sitemap index - lists all sub-sitemaps
   */
  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getSitemapIndex(): Promise<string> {
    return this.sitemapService.generateSitemapIndex();
  }

  /**
   * Campgrounds sitemap
   */
  @Get("sitemap-campgrounds.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getCampgroundsSitemap(): Promise<string> {
    return this.sitemapService.generateCampgroundsSitemap();
  }

  /**
   * Locations sitemap (states, cities)
   */
  @Get("sitemap-locations.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getLocationsSitemap(): Promise<string> {
    return this.sitemapService.generateLocationsSitemap();
  }

  /**
   * Attractions sitemap (national parks, lakes)
   */
  @Get("sitemap-attractions.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getAttractionsSitemap(): Promise<string> {
    return this.sitemapService.generateAttractionsSitemap();
  }

  /**
   * Software pages sitemap
   */
  @Get("sitemap-software.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getSoftwareSitemap(): Promise<string> {
    return this.sitemapService.generateSoftwareSitemap();
  }

  /**
   * Static pages sitemap
   */
  @Get("sitemap-pages.xml")
  @Header("Content-Type", "application/xml")
  @Header("Cache-Control", "public, max-age=3600")
  async getPagesSitemap(): Promise<string> {
    return this.sitemapService.generatePagesSitemap();
  }

  /**
   * robots.txt
   */
  @Get("robots.txt")
  @Header("Content-Type", "text/plain")
  @Header("Cache-Control", "public, max-age=86400")
  getRobotsTxt(): string {
    return this.sitemapService.generateRobotsTxt();
  }
}

/**
 * Admin controller for sitemap management
 */
@Controller("admin/seo")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class AdminSeoController {
  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * Clear sitemap cache to force regeneration
   */
  @Post("cache/clear")
  clearCache() {
    this.sitemapService.clearCache();
    return { message: "Sitemap cache cleared" };
  }
}
