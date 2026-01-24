import { describe, expect, it, beforeEach } from "vitest";
import {
  computeLevel,
  fetchLeaderboard,
  fetchStaffDashboard,
  fetchManagerSnapshot,
  awardManualXp,
  updateOptIn,
  overrideXp,
  listStaff,
  listCampgrounds,
} from "./stub-data";

describe("stub-data gamification", () => {
  beforeEach(() => {
    // reset toggles between tests
    const all = listCampgrounds();
    all.forEach((cg) => {
      updateOptIn(
        {
          enabled: true,
          enabledRoles: ["owner", "manager", "front_desk", "maintenance"],
          manualAwardsAllowed: true,
        },
        cg.id,
      );
    });
  });

  it("computes level progression", () => {
    const lvl1 = computeLevel(0);
    expect(lvl1.level).toBe(1);
    const lvl4 = computeLevel(900);
    expect(lvl4.level).toBeGreaterThanOrEqual(4);
    expect(lvl4.progressToNext).toBeGreaterThan(0);
  });

  it("returns staff dashboard with badges and challenges", async () => {
    const staff = listStaff()[0];
    const dash = await fetchStaffDashboard(staff.id);
    expect(dash.enabled).toBe(true);
    expect(dash.badges.length).toBeGreaterThan(0);
    expect(dash.weeklyChallenges.length).toBeGreaterThan(0);
  });

  it("awards manual XP and reflects in leaderboard", async () => {
    const staff = listStaff()[0];
    const before = await fetchStaffDashboard(staff.id);
    awardManualXp(staff.id, 50, "Test award");
    const after = await fetchStaffDashboard(staff.id);
    expect(after.balance.totalXp).toBeGreaterThan(before.balance.totalXp);
    const lb = await fetchLeaderboard("weekly", staff.id);
    expect(lb.leaderboard.some((row) => row.userId === staff.id)).toBe(true);
  });

  it("applies overrides and opt-in toggles for managers", async () => {
    const staff = listStaff()[1];
    overrideXp(staff.id, 1234);
    const dash = await fetchStaffDashboard(staff.id);
    expect(dash.balance.totalXp).toBe(1234);
    const snapshot = await fetchManagerSnapshot();
    expect(snapshot.optIn.enabled).toBe(true);
    updateOptIn({ enabled: false });
    const disabled = await fetchManagerSnapshot();
    expect(disabled.optIn.enabled).toBe(false);
  });

  it("scopes opt-in and awards per campground", async () => {
    const campgrounds = listCampgrounds();
    const targetCg = campgrounds[1]?.id || campgrounds[0].id;
    const staff = listStaff()[0];

    // Disable for target campground and ensure dashboard shows disabled.
    updateOptIn({ enabled: false }, targetCg);
    const disabledSnapshot = await fetchManagerSnapshot(targetCg);
    expect(disabledSnapshot.optIn.enabled).toBe(false);

    const before = await fetchStaffDashboard(staff.id, targetCg);
    awardManualXp(staff.id, 10, "No-op while disabled", "manual", undefined, targetCg);
    const after = await fetchStaffDashboard(staff.id, targetCg);
    expect(after.balance.totalXp).toBe(before.balance.totalXp);

    // Re-enable and confirm awards apply.
    updateOptIn({ enabled: true }, targetCg);
    const enabledSnapshot = await fetchManagerSnapshot(targetCg);
    expect(enabledSnapshot.optIn.enabled).toBe(true);
    const beforeEnabled = await fetchStaffDashboard(staff.id, targetCg);
    awardManualXp(staff.id, 10, "Applied after enable", "manual", undefined, targetCg);
    const afterEnabled = await fetchStaffDashboard(staff.id, targetCg);
    expect(afterEnabled.balance.totalXp).toBeGreaterThan(beforeEnabled.balance.totalXp);
  });
});
