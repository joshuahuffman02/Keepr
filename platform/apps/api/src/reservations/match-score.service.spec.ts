import {
  MatchScoreService,
  MatchResult,
  MatchScoreGuest,
  MatchScoreSite,
} from "./match-score.service";

describe("MatchScoreService", () => {
  let service: MatchScoreService;

  beforeEach(() => {
    service = new MatchScoreService();
  });

  const createGuest = (overrides: Partial<MatchScoreGuest> = {}): MatchScoreGuest => ({
    id: "guest-1",
    preferences: {},
    rigLength: null,
    reservations: [],
    ...overrides,
  });

  const createSite = (overrides: Partial<MatchScoreSite> = {}): MatchScoreSite => ({
    id: "site-1",
    siteClassId: "class-1",
    siteType: "rv",
    accessible: false,
    amenityTags: [],
    maxOccupancy: 4,
    rigMaxLength: 40,
    vibeTags: [],
    popularityScore: 50,
    SiteClass: null,
    ...overrides,
  });

  describe("calculateMatchScore", () => {
    describe("base score", () => {
      it("should return base score of 50 for a guest with no history or preferences", () => {
        const guest = createGuest();
        const site = createSite({ popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
        expect(result.reasons).toEqual([]);
      });
    });

    describe("hard constraints", () => {
      it("should return score 0 when guest rig is too long for site", () => {
        const guest = createGuest({ rigLength: 45 });
        const site = createSite({ rigMaxLength: 40 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(0);
        expect(result.reasons).toContain("Rig too long for site");
      });

      it("should not penalize when rig fits within site limits", () => {
        const guest = createGuest({ rigLength: 35 });
        const site = createSite({ rigMaxLength: 40, popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBeGreaterThan(0);
        expect(result.reasons).not.toContain("Rig too long for site");
      });

      it("should not penalize when site has no max length constraint", () => {
        const guest = createGuest({ rigLength: 50 });
        const site = createSite({ rigMaxLength: null, popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });

      it("should not penalize when guest has no rig length", () => {
        const guest = createGuest({ rigLength: null });
        const site = createSite({ rigMaxLength: 30, popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });
    });

    describe("history matching", () => {
      it("should add 30 points when guest has stayed in exact site before", () => {
        const guest = createGuest({
          reservations: [
            { id: "res-1", siteId: "site-1", Site: { id: "site-1", siteClassId: "class-1" } },
          ],
        });
        const site = createSite({ id: "site-1", siteClassId: "class-1", popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(80); // 50 + 30
        expect(result.reasons).toContain("Guest has stayed in this specific site before");
      });

      it("should add 15 points when guest has stayed in same site class", () => {
        const guest = createGuest({
          reservations: [
            { id: "res-1", siteId: "site-2", Site: { id: "site-2", siteClassId: "class-1" } },
          ],
        });
        const site = createSite({ id: "site-1", siteClassId: "class-1", popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(65); // 50 + 15
        expect(result.reasons).toContain("Guest has stayed in this site class before");
      });

      it("should prefer exact site match over class match", () => {
        const guest = createGuest({
          reservations: [
            { id: "res-1", siteId: "site-1", Site: { id: "site-1", siteClassId: "class-1" } },
            { id: "res-2", siteId: "site-2", Site: { id: "site-2", siteClassId: "class-1" } },
          ],
        });
        const site = createSite({ id: "site-1", siteClassId: "class-1", popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(80); // Only +30 for exact match, not +45
        expect(result.reasons).toContain("Guest has stayed in this specific site before");
        expect(result.reasons).not.toContain("Guest has stayed in this site class before");
      });

      it("should handle empty reservations array", () => {
        const guest = createGuest({ reservations: [] });
        const site = createSite({ popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });

      it("should handle undefined reservations", () => {
        const guest = createGuest({ reservations: undefined });
        const site = createSite({ popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });
    });

    describe("preference matching", () => {
      it("should add 15 points for secluded preference match", () => {
        const guest = createGuest({ preferences: { secluded: true } });
        const site = createSite({ vibeTags: ["Secluded"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(65); // 50 + 15
        expect(result.reasons).toContain("Matches preference: Secluded location");
      });

      it("should add 10 points for shade preference match", () => {
        const guest = createGuest({ preferences: { shade: true } });
        const site = createSite({ vibeTags: ["Shade"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(60); // 50 + 10
        expect(result.reasons).toContain("Matches preference: Shaded site");
      });

      it("should add 10 points for nearBathrooms preference match", () => {
        const guest = createGuest({ preferences: { nearBathrooms: true } });
        const site = createSite({ vibeTags: ["Near Bathrooms"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(60); // 50 + 10
        expect(result.reasons).toContain("Close to restrooms (accessibility)");
      });

      it("should stack multiple preference matches", () => {
        const guest = createGuest({
          preferences: { secluded: true, shade: true, nearBathrooms: true },
        });
        const site = createSite({
          vibeTags: ["Secluded", "Shade", "Near Bathrooms"],
          popularityScore: 0,
        });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(85); // 50 + 15 + 10 + 10
        expect(result.reasons).toHaveLength(3);
      });

      it("should not add points when preference is false", () => {
        const guest = createGuest({ preferences: { secluded: false } });
        const site = createSite({ vibeTags: ["Secluded"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
        expect(result.reasons).not.toContain("Matches preference: Secluded location");
      });

      it("should not add points when tag does not match preference", () => {
        const guest = createGuest({ preferences: { secluded: true } });
        const site = createSite({ vibeTags: ["Lake View"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(58);
        expect(result.reasons).toContain("Premium waterfront location");
      });

      it("should handle null preferences", () => {
        const guest = createGuest({ preferences: null });
        const site = createSite({ vibeTags: ["Secluded"], popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });
    });

    describe("popularity scoring", () => {
      it("should add popularity bonus (score / 5)", () => {
        const guest = createGuest();
        const site = createSite({ popularityScore: 100 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(70); // 50 + 20 (100/5)
      });

      it("should handle zero popularity", () => {
        const guest = createGuest();
        const site = createSite({ popularityScore: 0 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });

      it("should handle null popularity", () => {
        const guest = createGuest();
        const site = createSite({ popularityScore: null });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBe(50);
      });
    });

    describe("score capping", () => {
      it("should cap score at 100", () => {
        const guest = createGuest({
          preferences: { secluded: true, shade: true, nearBathrooms: true },
          reservations: [
            { id: "res-1", siteId: "site-1", Site: { id: "site-1", siteClassId: "class-1" } },
          ],
        });
        const site = createSite({
          id: "site-1",
          siteClassId: "class-1",
          vibeTags: ["Secluded", "Shade", "Near Bathrooms"],
          popularityScore: 100,
        });

        const result = service.calculateMatchScore(guest, site);

        // Would be: 50 + 30 + 15 + 10 + 10 + 20 = 135, but capped at 100
        expect(result.score).toBe(100);
      });

      it("should not return negative scores", () => {
        const guest = createGuest({ rigLength: 50 });
        const site = createSite({ rigMaxLength: 40 });

        const result = service.calculateMatchScore(guest, site);

        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    describe("combined scenarios", () => {
      it("should calculate correct score for returning guest with preferences", () => {
        const guest = createGuest({
          preferences: { secluded: true },
          reservations: [
            { id: "res-1", siteId: "site-2", Site: { id: "site-2", siteClassId: "class-1" } },
          ],
        });
        const site = createSite({
          id: "site-1",
          siteClassId: "class-1",
          vibeTags: ["Secluded"],
          popularityScore: 50,
        });

        const result = service.calculateMatchScore(guest, site);

        // 50 base + 15 class match + 15 secluded + 10 popularity
        expect(result.score).toBe(90);
        expect(result.reasons).toContain("Guest has stayed in this site class before");
        expect(result.reasons).toContain("Matches preference: Secluded location");
      });
    });
  });
});
