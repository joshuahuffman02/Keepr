import express = require("express");
import { Test, type TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { SupportController } from "../support/support.controller";
import { SupportService } from "../support/support.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";
import { buildAuthUser } from "../test-helpers/auth";

describe("Support reports smoke", () => {
  let moduleRef: TestingModule;
  let controller: SupportController;
  const campgroundId = "camp-support-smoke";
  const requestApp = express();
  const prismaMock = {
    supportReport: {
      findMany: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
    },
  };
  type AuthedRequest = Request & { user: AuthUser };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        SupportService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn().mockResolvedValue(true) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(SupportController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns region + campground scoped support reports", async () => {
    const sample = [
      {
        id: "r-1",
        rawContext: { region: "north" },
        campgroundId,
        status: "open",
      },
    ];
    prismaMock.supportReport.findMany.mockResolvedValue(sample);
    prismaMock.ticket.findMany.mockResolvedValue([]);

    const req: AuthedRequest = Object.assign(requestApp.request, {
      user: buildAuthUser({
        id: "support-user",
        role: "owner",
        region: "north",
        platformRole: "support_agent",
        platformRegion: "north",
        platformActive: true,
      }),
    });
    Object.defineProperty(req, "query", {
      value: { region: "north", campgroundId },
      configurable: true,
    });
    const res = await controller.list(req);

    expect(Array.isArray(res)).toBe(true);
    expect(res[0]?.id).toBe("r-1");

    expect(prismaMock.supportReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campgroundId,
          AND: expect.arrayContaining([
            expect.objectContaining({
              rawContext: expect.objectContaining({
                path: ["region"],
                equals: "north",
              }),
            }),
          ]),
        }),
        orderBy: { createdAt: "desc" },
        include: expect.any(Object),
      }),
    );
  });
});
