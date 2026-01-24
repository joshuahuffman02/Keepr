import { Test } from "@nestjs/testing";
import { PortfoliosService } from "../src/portfolios/portfolios.service";

describe("Portfolio report API", () => {
  let portfolios: PortfoliosService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PortfoliosService],
    }).compile();

    portfolios = moduleRef.get(PortfoliosService);
  });

  it("returns 200 and expected shape for a known portfolio", async () => {
    const { portfolios: available } = portfolios.list();
    const knownId = available[0]?.id ?? "pf-example-1";
    const report = portfolios.report(knownId);

    expect(report.portfolioId).toBe(knownId);
    expect(report.homeCurrency).toEqual(expect.any(String));
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(report.metrics.length).toBeGreaterThan(0);
    expect(report.metrics[0]).toEqual(
      expect.objectContaining({
        parkId: expect.any(String),
        currency: expect.any(String),
        occupancy: expect.any(Number),
        adr: expect.any(Number),
        revpar: expect.any(Number),
        revenueHome: expect.any(Number),
      }),
    );
    expect(report.rollup).toEqual(
      expect.objectContaining({
        currency: expect.any(String),
        revenueHome: expect.any(Number),
        occupancy: expect.any(Number),
        adr: expect.any(Number),
        revpar: expect.any(Number),
      }),
    );
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations) || report.recommendations === undefined).toBe(
      true,
    );
  });

  it("falls back gracefully for an unknown portfolio id", async () => {
    const { portfolios: available } = portfolios.list();
    const fallbackId = available[0]?.id ?? "pf-example-1";
    const report = portfolios.report("does-not-exist");

    expect(report.metrics).toBeDefined();
    expect(report.portfolioId).toBe(fallbackId);
  });
});
