import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { UserRole } from "@prisma/client";
import { PrivacyService } from "./privacy.service";
import type { Response } from "express";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("campgrounds/:campgroundId/privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Roles(UserRole.owner, UserRole.manager)
  @Get()
  async getSettings(@Param("campgroundId") campgroundId: string) {
    return this.privacy.getSettings(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post()
  async updateSettings(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: Partial<{
      redactPII: boolean;
      consentRequired: boolean;
      backupRetentionDays: number;
      keyRotationDays: number;
    }>,
  ) {
    return this.privacy.updateSettings(campgroundId, body);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("consents")
  async recordConsent(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: {
      subject: string;
      consentType: string;
      grantedBy: string;
      method?: string;
      purpose?: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.privacy.recordConsent({
      campgroundId,
      subject: body.subject,
      consentType: body.consentType,
      grantedBy: body.grantedBy,
      method: body.method,
      purpose: body.purpose,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      metadata: body.metadata ?? undefined,
    });
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.readonly)
  @Get("consents")
  async listConsents(@Param("campgroundId") campgroundId: string) {
    return this.privacy.listConsents(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Get("pii-tags")
  async listTags() {
    return this.privacy.listPiiTags();
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("pii-tags")
  async upsertTag(
    @Body()
    body: {
      resource: string;
      field: string;
      classification: string;
      redactionMode?: string;
      createdById?: string;
    },
  ) {
    return this.privacy.upsertPiiTag({
      resource: body.resource,
      field: body.field,
      classification: body.classification,
      redactionMode: body.redactionMode,
      createdById: body.createdById ?? null,
    });
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.readonly)
  @Get("redactions/recent")
  async recentRedactions(@Param("campgroundId") campgroundId: string) {
    return this.privacy.listRecentRedactions(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.readonly)
  @Post("preview")
  async preview(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { resource?: string; sample: unknown },
  ) {
    return this.privacy.previewRedaction(campgroundId, body.resource, body.sample);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Get("export")
  async export(
    @Param("campgroundId") campgroundId: string,
    @Query("format") format?: string,
    @Res() res?: Response,
  ) {
    if (format === "csv" && res) {
      return this.privacy.exportConsentCsv(campgroundId, res);
    }
    return this.privacy.exportConsentBundle(campgroundId);
  }
}
