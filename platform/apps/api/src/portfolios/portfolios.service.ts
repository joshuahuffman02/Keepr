import { Injectable } from "@nestjs/common";

type PortfolioPark = {
  id: string;
  name: string;
  region: string;
  currency: string;
  occupancy: number;
  adr: number;
  revpar: number;
  mtdRevenue: number;
  timezone?: string;
  fxToHome?: number;
  taxSummary?: string;
  routing?: {
    adminHost: string;
    guestHost: string;
    path: string;
  };
};

type Portfolio = {
  id: string;
  name: string;
  homeCurrency: string;
  parks: PortfolioPark[];
};

@Injectable()
export class PortfoliosService {
  // Demo portfolio data - to be replaced with real database queries
  private readonly portfolios: Portfolio[] = [
    {
      id: "pf-example-1",
      name: "Example Portfolio 1",
      homeCurrency: "USD",
      parks: [
        {
          id: "cg-example-1",
          name: "West Coast RV Park",
          region: "US-CA",
          currency: "USD",
          occupancy: 0.82,
          adr: 145,
          revpar: 118.9,
          mtdRevenue: 125000,
          timezone: "America/Los_Angeles",
          fxToHome: 1,
          taxSummary: "US sales/lodging tax blended 8.5%",
          routing: {
            adminHost: "example1.admin.campreserv.test",
            guestHost: "stay.example1.test",
            path: "/campgrounds/cg-example-1",
          },
        },
        {
          id: "cg-example-2",
          name: "Northern Campground",
          region: "CA-BC",
          currency: "CAD",
          occupancy: 0.76,
          adr: 170,
          revpar: 129.2,
          mtdRevenue: 98000,
          timezone: "America/Vancouver",
          fxToHome: 0.74,
          taxSummary: "GST 5% + PST 7%",
          routing: {
            adminHost: "example2.admin.campreserv.test",
            guestHost: "example2.travel.test",
            path: "/campgrounds/cg-example-2",
          },
        },
        {
          id: "cg-example-3",
          name: "European Resort",
          region: "DE-BY",
          currency: "EUR",
          occupancy: 0.81,
          adr: 130,
          revpar: 105.3,
          mtdRevenue: 87000,
          timezone: "Europe/Berlin",
          fxToHome: 1.07,
          taxSummary: "VAT 19% included",
          routing: {
            adminHost: "example3.admin.campreserv.test",
            guestHost: "example3.stays.test",
            path: "/campgrounds/cg-example-3",
          },
        },
      ],
    },
    {
      id: "pf-example-2",
      name: "Example Portfolio 2",
      homeCurrency: "USD",
      parks: [
        {
          id: "cg-example-4",
          name: "Southwest RV Resort",
          region: "US-AZ",
          currency: "USD",
          occupancy: 0.74,
          adr: 132,
          revpar: 97.7,
          mtdRevenue: 76000,
          timezone: "America/Phoenix",
          fxToHome: 1,
          taxSummary: "AZ transient tax 11%",
          routing: {
            adminHost: "example4.admin.campreserv.test",
            guestHost: "example4.test",
            path: "/campgrounds/cg-example-4",
          },
        },
        {
          id: "cg-example-5",
          name: "Coastal Campground",
          region: "US-FL",
          currency: "USD",
          occupancy: 0.79,
          adr: 155,
          revpar: 122.5,
          mtdRevenue: 89000,
          timezone: "America/Chicago",
          fxToHome: 1,
          taxSummary: "Tourist + state tax 11.5%",
          routing: {
            adminHost: "example5.admin.campreserv.test",
            guestHost: "example5.test",
            path: "/campgrounds/cg-example-5",
          },
        },
      ],
    },
  ];

  private selection: { portfolioId?: string; parkId?: string } = {};

  list() {
    const activePortfolioId = this.selection.portfolioId ?? this.portfolios[0]?.id ?? null;
    const activeParkId =
      this.selection.parkId ??
      this.portfolios.find((p) => p.id === activePortfolioId)?.parks[0]?.id ??
      this.portfolios[0]?.parks[0]?.id ??
      null;

    return {
      portfolios: this.portfolios,
      activePortfolioId,
      activeParkId,
    };
  }

  select(portfolioId: string, parkId?: string) {
    const portfolio = this.portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) {
      return this.list();
    }
    const resolvedParkId = parkId ?? portfolio.parks[0]?.id;
    this.selection = { portfolioId, parkId: resolvedParkId };
    return {
      activePortfolioId: portfolioId,
      activeParkId: resolvedParkId ?? null,
      routes: portfolio.parks.map((park) => ({
        parkId: park.id,
        adminHost: park.routing?.adminHost,
        guestHost: park.routing?.guestHost,
        path: park.routing?.path,
      })),
    };
  }

  report(portfolioId: string) {
    const portfolio = this.portfolios.find((p) => p.id === portfolioId) ?? this.portfolios[0];
    if (!portfolio)
      return { portfolioId, metrics: [], rollup: null, asOf: new Date().toISOString() };

    const metrics = portfolio.parks.map((park) => ({
      parkId: park.id,
      name: park.name,
      region: park.region,
      currency: park.currency,
      occupancy: park.occupancy,
      adr: park.adr,
      revpar: park.revpar,
      revenue: park.mtdRevenue,
      revenueHome: park.fxToHome ? Math.round(park.mtdRevenue * park.fxToHome) : park.mtdRevenue,
      taxSummary: park.taxSummary,
      fxToHome: park.fxToHome ?? 1,
    }));

    const rollup = metrics.reduce(
      (acc, m) => {
        acc.revenueHome += m.revenueHome;
        acc.occupancy += m.occupancy;
        acc.adr += m.adr;
        acc.revpar += m.revpar;
        return acc;
      },
      { revenueHome: 0, occupancy: 0, adr: 0, revpar: 0 },
    );

    const count = metrics.length || 1;

    return {
      portfolioId: portfolio.id,
      homeCurrency: portfolio.homeCurrency,
      asOf: new Date().toISOString(),
      metrics,
      rollup: {
        currency: portfolio.homeCurrency,
        revenueHome: Math.round(rollup.revenueHome),
        occupancy: Number((rollup.occupancy / count).toFixed(2)),
        adr: Number((rollup.adr / count).toFixed(2)),
        revpar: Number((rollup.revpar / count).toFixed(2)),
      },
      routing: portfolio.parks.map((p) => ({
        parkId: p.id,
        adminHost: p.routing?.adminHost,
        guestHost: p.routing?.guestHost,
        path: p.routing?.path,
      })),
      recommendations: [
        {
          id: "fx-hedge",
          title: "CAD exposure trending up",
          impact: "Track CAD → USD swings for BC parks; consider monthly hedge.",
          area: "Finance",
        },
        {
          id: "eu-vat",
          title: "VAT-inclusive pricing",
          impact: "EU parks already return VAT-inclusive rates; verify guest invoices.",
          area: "Compliance",
        },
      ],
    };
  }
}
