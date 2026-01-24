import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SupportAdminPage from "./page";

const mockFetch = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1", email: "hello@keeprstay.com" } } }),
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/support",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("SupportAdminPage", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const fetchMock: typeof fetch = (input, init) => mockFetch(input, init);
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("campreserv:selectedCampground", "cg1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the mobile quick actions bar with support anchors", async () => {
    render(<SupportAdminPage />);

    const nav = await screen.findByLabelText("Mobile quick actions");
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tasks/i })).toHaveAttribute("href", "#support-queue");
    expect(screen.getByRole("link", { name: /Messages/i })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: /Checklists/i })).toHaveAttribute(
      "href",
      "/operations#checklists",
    );
  });
});
