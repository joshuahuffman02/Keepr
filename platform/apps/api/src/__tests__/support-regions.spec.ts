import { ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import express = require("express");
import type { Request } from "express";
import { SupportController } from "../support/support.controller";
import { SupportService } from "../support/support.service";
import { EmailService } from "../email/email.service";
import { PermissionsService } from "../permissions/permissions.service";
import type { AuthUser } from "../auth/auth.types";
import { buildAuthMembership, buildAuthUser } from "../test-helpers/auth";

// Covers region filter, region-scoped assignment, and staff directory endpoint (stub notify handled client-side)

describe("Support regions & directory", () => {
  let moduleRef: TestingModule;
  let controller: SupportController;
  const campgroundId = "camp-support-test";
  const userA = "user-a"; // region north
  const userB = "user-b"; // region south
  const adminUser = "admin-user";
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const expressApp = express();
  const buildRequest = (
    user: AuthUser,
    query: Record<string, string | string[] | undefined> = {},
  ): Request & { user: AuthUser } => {
    const req: Request & { user: AuthUser } = Object.create(expressApp.request);
    Object.defineProperty(req, "user", { value: user, writable: true, configurable: true });
    Object.defineProperty(req, "query", { value: query, writable: true, configurable: true });
    Object.defineProperty(req, "headers", { value: {}, writable: true, configurable: true });
    return req;
  };

  beforeAll(async () => {
    const reports: Array<{
      id: string;
      campgroundId: string | null;
      rawContext: { region?: string | null };
      createdAt: Date;
      updatedAt: Date;
      status: string;
    }> = [];
    const staffDirectory = [
      {
        id: adminUser,
        email: "admin@test.com",
        firstName: "Admin",
        lastName: "User",
        region: "north",
      },
      { id: userA, email: "a@test.com", firstName: "A", lastName: "North", region: "north" },
      { id: userB, email: "b@test.com", firstName: "B", lastName: "South", region: "south" },
    ];
    const supportStub = {
      create: jest.fn(
        (dto: { description: string; campgroundId?: string | null; region?: string | null }) => {
          const report = {
            id: `support-${reports.length + 1}`,
            description: dto.description,
            campgroundId: dto.campgroundId ?? null,
            rawContext: { region: dto.region ?? null },
            createdAt: new Date(),
            updatedAt: new Date(),
            status: "new",
          };
          reports.unshift(report);
          return report;
        },
      ),
      findAll: jest.fn((args: { region?: string | null; campgroundId?: string | null }) => {
        return reports.filter((report) => {
          if (args.campgroundId && report.campgroundId !== args.campgroundId) return false;
          if (args.region && report.rawContext.region !== args.region) return false;
          return true;
        });
      }),
      update: jest.fn(
        (
          id: string,
          dto: { assigneeId?: string | null; status?: string | null },
          _actorId?: string,
          actorRegion?: string | null,
        ) => {
          const report = reports.find((row) => row.id === id);
          if (!report) return null;
          if (
            report.rawContext?.region &&
            actorRegion &&
            report.rawContext.region !== actorRegion
          ) {
            throw new ForbiddenException("Forbidden by region scope");
          }
          if (dto.status) {
            report.status = dto.status;
          }
          return report;
        },
      ),
      staffDirectory: jest.fn((args: { region?: string | null }) => {
        if (!args.region) return staffDirectory;
        return staffDirectory.filter((row) => row.region === args.region);
      }),
    };

    moduleRef = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        { provide: SupportService, useValue: supportStub },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: PermissionsService,
          useValue: { checkAccess: async () => ({ allowed: true }), isPlatformStaff: () => true },
        },
      ],
    }).compile();

    controller = moduleRef.get(SupportController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("filters reports by region and blocks cross-region assignment", async () => {
    const adminReq = buildRequest(
      buildAuthUser({
        id: "admin-user",
        role: "owner",
        region: "north",
        memberships: [buildAuthMembership({ campgroundId, role: "owner" })],
      }),
    );

    // create two reports in different regions
    const rNorth = await controller.create(
      { description: "north issue", region: "north", campgroundId, pinnedIds: [], recentIds: [] },
      adminReq,
    );
    const rSouth = await controller.create(
      { description: "south issue", region: "south", campgroundId, pinnedIds: [], recentIds: [] },
      adminReq,
    );

    const listNorth = await controller.list(buildRequest(adminReq.user, { region: "north" }));
    const listRows = Array.isArray(listNorth) ? listNorth : [];
    expect(
      listRows.some((row) => isRecord(row) && typeof row.id === "string" && row.id === rNorth.id),
    ).toBe(true);
    expect(
      listRows.some((row) => isRecord(row) && typeof row.id === "string" && row.id === rSouth.id),
    ).toBe(false);

    // attempt cross-region assignment should 403
    await expect(controller.update(rSouth.id, { assigneeId: userA }, adminReq)).rejects.toThrow(
      "Forbidden by region scope",
    );
  });

  it("returns staff directory filtered by region", async () => {
    const adminReq = buildRequest(
      buildAuthUser({
        id: "admin-user",
        role: "owner",
        region: "north",
        memberships: [buildAuthMembership({ campgroundId, role: "owner" })],
      }),
    );
    const all = await controller.staffDirectory(adminReq);
    expect(all.length).toBeGreaterThanOrEqual(2);
    const northOnly = await controller.staffDirectory(
      buildRequest(adminReq.user, { region: "north" }),
    );
    expect(northOnly.length).toBeGreaterThanOrEqual(1);
    expect(
      Array.isArray(northOnly) && northOnly.some((row) => isRecord(row) && row.region === "south"),
    ).toBe(false);
  });
});
