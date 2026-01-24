import { Test } from "@nestjs/testing";
import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { ReportsService } from "../reports/reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from "../email/email.service";
import { AbandonedCartService } from "../abandoned-cart/abandoned-cart.service";
import { MembershipsService } from "../memberships/memberships.service";
import { SignaturesService } from "../signatures/signatures.service";
import { PoliciesService } from "../policies/policies.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { StripeService } from "../payments/stripe.service";
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { UploadsService } from "../uploads/uploads.service";
import { AuditService } from "../audit/audit.service";
import { JobQueueService } from "../observability/job-queue.service";

const getPrivateMethod = (target: object, key: string): Function => {
  const value = Reflect.get(target, key);
  if (typeof value !== "function") {
    throw new Error(`Expected ${key} to be a function`);
  }
  return value;
};

describe("Referral codes and stay reasons", () => {
  const observabilityStub = { recordReportResult: jest.fn() };
  const alertingStub = { dispatch: jest.fn() };
  const dashboardStub = {
    summary: jest.fn().mockResolvedValue({
      campground: { id: "cg-1", name: "Camp" },
      sites: 10,
      futureReservations: 0,
      occupancy: 0,
      adr: 0,
      revpar: 0,
      revenue: 0,
      overdueBalance: 0,
      maintenanceOpen: 0,
      maintenanceOverdue: 0,
    }),
  };
  const uploadsStub = {};
  const auditStub = { record: jest.fn() };
  const jobQueueStub = { enqueue: jest.fn() };
  const emailStub = {};

  it("applies referral incentive when resolving programs", async () => {
    const prismaStub = {
      referralProgram: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ref-1",
          code: "FRIEND10",
          incentiveType: "percent_discount",
          incentiveValue: 10,
          source: "friend",
          channel: "link",
        }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicReservationsService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: LockService, useValue: {} },
        { provide: PromotionsService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: AbandonedCartService, useValue: {} },
        { provide: MembershipsService, useValue: {} },
        { provide: SignaturesService, useValue: {} },
        { provide: PoliciesService, useValue: {} },
        { provide: AccessControlService, useValue: {} },
        { provide: PricingV2Service, useValue: {} },
        { provide: DepositPoliciesService, useValue: { calculateDeposit: jest.fn() } },
        { provide: StripeService, useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(PublicReservationsService);

    try {
      const resolveReferralProgram = getPrivateMethod(svc, "resolveReferralProgram");
      const result = await resolveReferralProgram.call(svc, "cg-1", "FRIEND10", null, 25000);
      expect(result.discountCents).toBe(2500);
      expect(result.source).toBe("friend");
      expect(result.channel).toBe("link");
    } finally {
      await moduleRef.close();
    }
  });

  it("aggregates referral performance", async () => {
    const prismaStub = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            totalAmount: 50000,
            discountsAmount: 5000,
            referralProgramId: "ref-1",
            referralCode: "FRIEND10",
            referralIncentiveType: "amount_discount",
            referralIncentiveValue: 5000,
            referralSource: "friend",
            referralChannel: "email",
          },
          {
            totalAmount: 30000,
            discountsAmount: 3000,
            referralProgramId: null,
            referralCode: "BLOG",
            referralIncentiveType: "amount_discount",
            referralIncentiveValue: 3000,
            referralSource: "blog",
            referralChannel: "social",
          },
        ]),
      },
      referralProgram: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: "ref-1", code: "FRIEND10", source: "friend", channel: "email" },
          ]),
      },
      integrationExportJob: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: ObservabilityService, useValue: observabilityStub },
        { provide: AlertingService, useValue: alertingStub },
        { provide: DashboardService, useValue: dashboardStub },
        { provide: UploadsService, useValue: uploadsStub },
        { provide: AuditService, useValue: auditStub },
        { provide: JobQueueService, useValue: jobQueueStub },
        { provide: EmailService, useValue: emailStub },
      ],
    }).compile();

    const svc = moduleRef.get(ReportsService);
    try {
      const report = await svc.getReferralPerformance("cg-1");

      expect(report.totalBookings).toBe(2);
      expect(report.totalReferralDiscountCents).toBe(8000);
      expect(report.programs.find((program) => program.code === "FRIEND10")?.bookings).toBe(1);
    } finally {
      await moduleRef.close();
    }
  });

  it("breaks down stay reasons including other text", async () => {
    const prismaStub = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          { stayReasonPreset: "vacation", stayReasonOther: null },
          { stayReasonPreset: "vacation", stayReasonOther: null },
          { stayReasonPreset: "work_remote", stayReasonOther: null },
          { stayReasonPreset: "other", stayReasonOther: "climbing comp" },
        ]),
      },
      integrationExportJob: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: ObservabilityService, useValue: observabilityStub },
        { provide: AlertingService, useValue: alertingStub },
        { provide: DashboardService, useValue: dashboardStub },
        { provide: UploadsService, useValue: uploadsStub },
        { provide: AuditService, useValue: auditStub },
        { provide: JobQueueService, useValue: jobQueueStub },
        { provide: EmailService, useValue: emailStub },
      ],
    }).compile();

    const svc = moduleRef.get(ReportsService);
    try {
      const breakdown = await svc.getStayReasonBreakdown("cg-1");

      const vacationRow = breakdown.breakdown.find((row) => row.reason === "vacation");
      expect(vacationRow?.count).toBe(2);
      expect(breakdown.otherReasons).toContain("climbing comp");
    } finally {
      await moduleRef.close();
    }
  });
});
