import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class MenuConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's menu configuration, creating default if none exists
   */
  async getConfig(userId: string) {
    let config = await this.prisma.userMenuConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      // Create default config - will be populated with role-based defaults on frontend
      config = await this.prisma.userMenuConfig.create({
        data: {
          id: randomUUID(),
          userId,
          pinnedPages: [],
          sidebarCollapsed: false,
          migratedFromLocal: false,
          updatedAt: new Date(),
        },
      });
    }

    return config;
  }

  /**
   * Update user's menu configuration
   */
  async updateConfig(
    userId: string,
    data: {
      pinnedPages?: string[];
      sidebarCollapsed?: boolean;
    },
  ) {
    return this.prisma.userMenuConfig.upsert({
      where: { userId },
      update: data,
      create: {
        id: randomUUID(),
        userId,
        pinnedPages: data.pinnedPages ?? [],
        sidebarCollapsed: data.sidebarCollapsed ?? false,
        migratedFromLocal: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Pin a page to the sidebar
   */
  async pinPage(userId: string, href: string) {
    const config = await this.getConfig(userId);
    const pinnedPages = config.pinnedPages || [];

    // Don't add duplicates
    if (pinnedPages.includes(href)) {
      return config;
    }

    // Add to beginning, limit to 20 pins
    const newPinnedPages = [href, ...pinnedPages].slice(0, 20);

    return this.prisma.userMenuConfig.update({
      where: { userId },
      data: { pinnedPages: newPinnedPages },
    });
  }

  /**
   * Unpin a page from the sidebar
   */
  async unpinPage(userId: string, href: string) {
    const config = await this.getConfig(userId);
    const pinnedPages = config.pinnedPages || [];

    return this.prisma.userMenuConfig.update({
      where: { userId },
      data: {
        pinnedPages: pinnedPages.filter((p) => p !== href),
      },
    });
  }

  /**
   * Reorder pinned pages
   */
  async reorderPages(userId: string, pinnedPages: string[]) {
    return this.prisma.userMenuConfig.update({
      where: { userId },
      data: { pinnedPages },
    });
  }

  /**
   * Migrate from localStorage data
   */
  async migrateFromLocal(
    userId: string,
    data: {
      pinnedPages: string[];
      sidebarCollapsed?: boolean;
    },
  ) {
    // Only migrate if not already migrated
    const existing = await this.prisma.userMenuConfig.findUnique({
      where: { userId },
    });

    if (existing?.migratedFromLocal) {
      return existing;
    }

    return this.prisma.userMenuConfig.upsert({
      where: { userId },
      update: {
        pinnedPages: data.pinnedPages,
        sidebarCollapsed: data.sidebarCollapsed ?? false,
        migratedFromLocal: true,
      },
      create: {
        id: randomUUID(),
        userId,
        pinnedPages: data.pinnedPages,
        sidebarCollapsed: data.sidebarCollapsed ?? false,
        migratedFromLocal: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Reset to role-based defaults (clears pinned pages)
   */
  async resetToDefaults(userId: string) {
    return this.prisma.userMenuConfig.update({
      where: { userId },
      data: {
        pinnedPages: [],
        migratedFromLocal: false,
      },
    });
  }
}
