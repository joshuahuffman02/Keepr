import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SupportAnalyticsPage from "./page";

const mockFetch = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-whoami", () => ({
  useWhoami: () => ({
    data: {
      user: { memberships: [{ campgroundId: "cg1" }], region: "north" },
      allowed: { supportAssign: true },
    },
    isLoading: false,
    error: null,
  }),
}));

describe("SupportAnalyticsPage", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: "2025-12-08T00:00:00Z",
        source: "stub",
        slaSummary: [
          {
            region: "north",
            campgroundId: "cg1",
            campgroundName: "North Pines",
            onTime: 10,
            overdue: 2,
            slaTargetHours: 24,
          },
        ],
        volumesByCategory: [{ category: "Bugs / Errors", count: 5 }],
        needsAttention: [
          {
            id: "sup-1",
            title: "Example overdue ticket",
            region: "north",
            campgroundId: "cg1",
            status: "overdue",
            category: "Bugs / Errors",
            reportedAt: "2025-12-08T00:00:00Z",
            slaBreachedMinutes: 30,
          },
        ],
      }),
    });
    const fetchMock: typeof fetch = (input, init) => mockFetch(input, init);
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("campreserv:selectedCampground", "cg1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders analytics sections with stubbed data", async () => {
    render(<SupportAnalyticsPage />);

    expect(await screen.findByText(/Support analytics/i)).toBeInTheDocument();
    expect(await screen.findByText(/Stub data/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /SLA compliance/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Needs attention/i })).toBeInTheDocument();
    expect(await screen.findByText(/Example overdue ticket/i)).toBeInTheDocument();
  });
});
