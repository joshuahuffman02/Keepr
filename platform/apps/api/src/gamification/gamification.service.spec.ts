import { UserRole } from "@prisma/client";
import { computeLevel, resolveXpAmount, roleAllowed } from "./gamification.service";

describe("GamificationService helpers", () => {
  it("computes level progress with next threshold", () => {
    const levels = [
      { level: 1, minXp: 0, name: "New Recruit" },
      { level: 2, minXp: 200, name: "Operator" },
      { level: 3, minXp: 600, name: "Specialist" },
    ];

    const result = computeLevel(450, levels);

    expect(result.level).toBe(2);
    expect(result.nextLevel).toBe(3);
    expect(result.progressToNext).toBeCloseTo((450 - 200) / (600 - 200));
  });

  it("clamps XP with rules", () => {
    expect(resolveXpAmount(undefined, { minXp: 10, maxXp: 50, defaultXp: 25 })).toBe(25);
    expect(resolveXpAmount(5, { minXp: 10, maxXp: 50, defaultXp: 25 })).toBe(10);
    expect(resolveXpAmount(80, { minXp: 10, maxXp: 50, defaultXp: 25 })).toBe(50);
  });

  it("honors role allow lists", () => {
    expect(roleAllowed({ enabledRoles: [] }, UserRole.front_desk)).toBe(true);
    expect(roleAllowed({ enabledRoles: [UserRole.manager] }, UserRole.front_desk)).toBe(false);
    expect(
      roleAllowed({ enabledRoles: [UserRole.manager, UserRole.maintenance] }, UserRole.maintenance),
    ).toBe(true);
  });
});
