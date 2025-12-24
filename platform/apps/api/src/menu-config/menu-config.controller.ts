import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { MenuConfigService } from "./menu-config.service";
import { JwtAuthGuard } from "../auth/guards";
import type { Request } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller("menu-config")
export class MenuConfigController {
  constructor(private readonly menuConfig: MenuConfigService) {}

  /**
   * Get user's menu configuration
   */
  @Get()
  async getConfig(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.menuConfig.getConfig(userId);
  }

  /**
   * Update user's menu configuration
   */
  @Patch()
  async updateConfig(
    @Req() req: AuthenticatedRequest,
    @Body() body: { pinnedPages?: string[]; sidebarCollapsed?: boolean }
  ) {
    const userId = req.user.id;
    return this.menuConfig.updateConfig(userId, body);
  }

  /**
   * Pin a page to sidebar
   */
  @Post("pin")
  @HttpCode(HttpStatus.OK)
  async pinPage(
    @Req() req: AuthenticatedRequest,
    @Body() body: { href: string }
  ) {
    const userId = req.user.id;
    return this.menuConfig.pinPage(userId, body.href);
  }

  /**
   * Unpin a page from sidebar
   */
  @Delete("pin/:href")
  async unpinPage(
    @Req() req: AuthenticatedRequest,
    @Param("href") href: string
  ) {
    const userId = req.user.id;
    // URL decode the href parameter
    const decodedHref = decodeURIComponent(href);
    return this.menuConfig.unpinPage(userId, decodedHref);
  }

  /**
   * Reorder pinned pages
   */
  @Post("reorder")
  @HttpCode(HttpStatus.OK)
  async reorderPages(
    @Req() req: AuthenticatedRequest,
    @Body() body: { pinnedPages: string[] }
  ) {
    const userId = req.user.id;
    return this.menuConfig.reorderPages(userId, body.pinnedPages);
  }

  /**
   * Migrate from localStorage
   */
  @Post("migrate-local")
  @HttpCode(HttpStatus.OK)
  async migrateFromLocal(
    @Req() req: AuthenticatedRequest,
    @Body() body: { pinnedPages: string[]; sidebarCollapsed?: boolean }
  ) {
    const userId = req.user.id;
    return this.menuConfig.migrateFromLocal(userId, body);
  }

  /**
   * Reset to role defaults
   */
  @Post("reset")
  @HttpCode(HttpStatus.OK)
  async resetToDefaults(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.menuConfig.resetToDefaults(userId);
  }
}
