import { Module } from "@nestjs/common";
import { SitemapController, AdminSeoController } from "./sitemap.controller";
import { SitemapService } from "./sitemap.service";
import { PrismaModule } from "../prisma/prisma.module";

/**
 * SEO Module
 *
 * Handles all SEO-related functionality:
 * - Sitemap generation (XML)
 * - robots.txt
 * - Structured data (future)
 * - Meta tag management (future)
 */
@Module({
  imports: [PrismaModule],
  controllers: [SitemapController, AdminSeoController],
  providers: [SitemapService],
  exports: [SitemapService],
})
export class SeoModule {}
