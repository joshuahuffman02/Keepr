// @ts-nocheck
import { PublicReservationsService } from "../public-reservations/public-reservations.service";
import { ReportsService } from "../reports/reports.service";

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
      maintenanceOverdue: 0
    })
  };

  it("applies referral incentive when resolving programs", async () => {
    const prismaStub = {
      referralProgram: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ref-1",
          code: "FRIEND10",
          incentiveType: "percent_discount",
          incentiveValue: 10,
          source: "friend",
          channel: "link"
        })
      }
    };

    const svc = new PublicReservationsService(
      prismaStub as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const result = await (svc as any).resolveReferralProgram("cg-1", "FRIEND10", null, 25000);
    expect(result.discountCents).toBe(2500);
    expect(result.source).toBe("friend");
    expect(result.channel).toBe("link");
  });

  it("aggregates referral performance", async () => {
    const prismaStub: any = {
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
            referralChannel: "email"
          },
          {
            totalAmount: 30000,
            discountsAmount: 3000,
            referralProgramId: null,
            referralCode: "BLOG",
            referralIncentiveType: "amount_discount",
            referralIncentiveValue: 3000,
            referralSource: "blog",
            referralChannel: "social"
          }
        ])
      },
      referralProgram: {
        findMany: jest.fn().mockResolvedValue([{ id: "ref-1", code: "FRIEND10", source: "friend", channel: "email" }])
      },
      integrationExportJob: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() }
    };

    const svc = new ReportsService(prismaStub as any, observabilityStub as any, alertingStub as any, dashboardStub as any);
    const report = await svc.getReferralPerformance("cg-1");

    expect(report.totalBookings).toBe(2);
    expect(report.totalReferralDiscountCents).toBe(8000);
    expect(report.programs.find((p: any) => p.code === "FRIEND10")?.bookings).toBe(1);
  });

  it("breaks down stay reasons including other text", async () => {
    const prismaStub: any = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          { stayReasonPreset: "vacation", stayReasonOther: null },
          { stayReasonPreset: "vacation", stayReasonOther: null },
          { stayReasonPreset: "work_remote", stayReasonOther: null },
          { stayReasonPreset: "other", stayReasonOther: "climbing comp" }
        ])
      },
      integrationExportJob: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), count: jest.fn() }
    };

    const svc = new ReportsService(prismaStub as any, observabilityStub as any, alertingStub as any, dashboardStub as any);
    const breakdown = await svc.getStayReasonBreakdown("cg-1");

    const vacationRow = breakdown.breakdown.find((b: any) => b.reason === "vacation");
    expect(vacationRow?.count).toBe(2);
    expect(breakdown.otherReasons).toContain("climbing comp");
  });
});
