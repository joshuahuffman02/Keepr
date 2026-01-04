import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { SoftwarePagesService } from "./software-pages.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole } from "@prisma/client";

/**
 * Software Pages Controller
 *
 * Public endpoints for B2B SEO pages:
 * - /compare/[competitor] - Competitor comparison pages
 * - /features/[feature] - Feature-focused pages
 * - /software - Software overview/index
 */

@Controller("public/software")
export class PublicSoftwarePagesController {
  constructor(private readonly softwarePages: SoftwarePagesService) {}

  /**
   * Get a software page by slug
   */
  @Get("page/:slug")
  async getPage(@Param("slug") slug: string) {
    const page = await this.softwarePages.getPageBySlug(slug);
    if (!page) {
      throw new NotFoundException(`Page not found: ${slug}`);
    }
    return page;
  }

  /**
   * Get competitor comparison
   */
  @Get("compare/:competitor")
  async getCompetitorComparison(@Param("competitor") competitor: string) {
    const comparison = this.softwarePages.getCompetitorComparison(competitor);
    if (!comparison) {
      throw new NotFoundException(`Competitor not found: ${competitor}`);
    }

    return {
      competitor: comparison.competitorName,
      slug: comparison.competitorSlug,
      metaTitle: `${comparison.competitorName} Alternative | Keepr vs ${comparison.competitorName}`,
      metaDescription: `Looking for a ${comparison.competitorName} alternative? Compare features, pricing, and see why campgrounds are switching to Keepr.`,
      ...comparison,
    };
  }

  /**
   * List all competitors
   */
  @Get("compare")
  async listCompetitors() {
    return this.softwarePages.listCompetitors();
  }

  /**
   * Get feature page
   */
  @Get("features/:feature")
  async getFeaturePage(@Param("feature") feature: string) {
    const page = this.softwarePages.getFeaturePage(feature);
    if (!page) {
      throw new NotFoundException(`Feature not found: ${feature}`);
    }

    return {
      ...page,
      metaTitle: `${page.title} | Keepr`,
      metaDescription: page.description,
    };
  }

  /**
   * List all feature pages
   */
  @Get("features")
  async listFeaturePages() {
    return this.softwarePages.listFeaturePages();
  }
}

/**
 * Admin controller for managing software pages
 */
@Controller("admin/software-pages")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class AdminSoftwarePagesController {
  constructor(private readonly softwarePages: SoftwarePagesService) {}

  /**
   * Seed initial software pages
   */
  @Post("seed")
  async seedPages() {
    const count = await this.softwarePages.seedSoftwarePages();
    return { message: `Seeded ${count} software pages`, count };
  }
}
