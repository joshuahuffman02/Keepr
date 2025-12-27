// ============================================================================
// STUB DATA - FOR TESTING AND STORYBOOK ONLY
// ============================================================================
// This file contains stub data for gamification features.
// It is NOT used in production - the real app uses the backend API.
// Only imported by: tests and storybook stories.
//
// Production code uses: apiClient.getGamificationDashboard() and related endpoints
// Backend implementation: platform/apps/api/src/gamification/
// ============================================================================

export type GamificationCategory =
  | "task"
  | "maintenance"
  | "check_in"
  | "reservation_quality"
  | "checklist"
  | "review_mention"
  | "on_time_assignment"
  | "assist"
  | "manual"
  | "other";

export type GamificationEvent = {
  id: string;
  userId: string;
  category: GamificationCategory;
  xp: number;
  reason?: string;
  createdAt: string;
};

export type GamificationBadge = {
  id: string;
  name: string;
  description: string;
  tier?: "bronze" | "silver" | "gold" | "platinum";
  earnedAt: string;
  icon?: string;
};

export type ChallengeStatus = "active" | "completed" | "failed";

export type ChallengeDefinition = {
  id: string;
  title: string;
  description: string;
  rewardBadge?: string;
  targetXp: number;
  cadence: "weekly" | "seasonal";
};

export type ChallengeProgress = {
  challengeId: string;
  currentXp: number;
  status: ChallengeStatus;
};

export type OptInState = {
  enabled: boolean;
  enabledRoles: string[];
  manualAwardsAllowed: boolean;
};

export type CampgroundStub = {
  id: string;
  name: string;
  region?: string;
  status?: "active" | "demo" | "paused";
};

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  totalXp: number;
  weeklyXp: number;
  seasonalXp: number;
  badges: GamificationBadge[];
  challenges: ChallengeProgress[];
};

export type GamificationNotification = {
  id: string;
  type: "xp_award" | "badge_unlock" | "generic" | "override";
  userId?: string;
  message: string;
  meta?: Record<string, any>;
  createdAt: string;
};

export type GamificationHistoryEntry = {
  id: string;
  type: "xp_award" | "badge_unlock" | "override";
  userId?: string;
  userName?: string;
  role?: string;
  xp?: number;
  reason?: string;
  badgeName?: string;
  badgeTier?: GamificationBadge["tier"];
  createdAt: string;
};

type StubState = {
  staff: StaffMember[];
  events: GamificationEvent[];
  challenges: ChallengeDefinition[];
  badgeLibrary: GamificationBadge[];
  notifications: GamificationNotification[];
};

const levels = [
  { level: 1, minXp: 0 },
  { level: 2, minXp: 150 },
  { level: 3, minXp: 400 },
  { level: 4, minXp: 800 },
  { level: 5, minXp: 1300 },
  { level: 6, minXp: 2000 },
];

const now = Date.now();

const campgrounds: CampgroundStub[] = [
  { id: "cg-redwood", name: "Redwood Ridge", region: "CA North", status: "active" },
  { id: "cg-lakeside", name: "Lakeside Lookout", region: "PNW", status: "demo" },
  { id: "cg-canyon", name: "Canyon Vista", region: "Southwest", status: "active" },
];

const defaultCampgroundId = campgrounds[0]?.id || "cg-default";

const initialState: StubState = {
  staff: [
    {
      id: "u-1",
      name: "Sierra Nguyen",
      role: "front_desk",
      totalXp: 1280,
      weeklyXp: 240,
      seasonalXp: 860,
      badges: [
        { id: "b-1", name: "Hospitality Hero", description: "5 perfect check-ins", tier: "silver", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString() },
        { id: "b-2", name: "Team Assist", description: "Helped teammates 3 times", tier: "bronze", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString() },
      ],
      challenges: [
        { challengeId: "welcome-wow", currentXp: 45, status: "active" },
        { challengeId: "ops-uptime", currentXp: 20, status: "active" },
      ],
    },
    {
      id: "u-2",
      name: "Devon Hart",
      role: "maintenance",
      totalXp: 980,
      weeklyXp: 210,
      seasonalXp: 720,
      badges: [
        { id: "b-3", name: "Maintenance Ace", description: "Closed 10 tickets", tier: "silver", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 9).toISOString() },
      ],
      challenges: [
        { challengeId: "ops-uptime", currentXp: 55, status: "active" },
      ],
    },
    {
      id: "u-3",
      name: "Priya Mehta",
      role: "manager",
      totalXp: 1675,
      weeklyXp: 310,
      seasonalXp: 1120,
      badges: [
        { id: "b-4", name: "Coaching Star", description: "Mentored staff to hit goals", tier: "gold", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString() },
      ],
      challenges: [
        { challengeId: "coaching-loop", currentXp: 70, status: "active" },
      ],
    },
  ],
  challenges: [
    {
      id: "welcome-wow",
      title: "Welcome WOWs",
      description: "Earn XP from clean, on-time check-ins this week.",
      rewardBadge: "Hospitality Hero",
      targetXp: 60,
      cadence: "weekly",
    },
    {
      id: "ops-uptime",
      title: "Ops Uptime",
      description: "Resolve maintenance tickets before SLA.",
      rewardBadge: "Reliability Ribbon",
      targetXp: 80,
      cadence: "weekly",
    },
    {
      id: "coaching-loop",
      title: "Coach & Recognize",
      description: "Coach teammates and grant merit XP.",
      rewardBadge: "Coaching Star",
      targetXp: 100,
      cadence: "weekly",
    },
  ],
  events: [
    {
      id: "e-1",
      userId: "u-1",
      category: "check_in",
      xp: 25,
      reason: "On-time arrival welcome",
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: "e-2",
      userId: "u-1",
      category: "assist",
      xp: 15,
      reason: "Helped with reservations queue",
      createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
    },
    {
      id: "e-3",
      userId: "u-2",
      category: "maintenance",
      xp: 40,
      reason: "Resolved AC outage",
      createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: "e-4",
      userId: "u-3",
      category: "manual",
      xp: 30,
      reason: "Coaching recognition",
      createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    },
    {
      id: "e-5",
      userId: "u-1",
      category: "checklist",
      xp: 20,
      reason: "Closed opening checklist",
      createdAt: new Date(now - 1000 * 60 * 60 * 40).toISOString(),
    },
  ],
  badgeLibrary: [
    { id: "lib-hero", name: "Hospitality Hero", description: "Flawless welcomes and on-time arrivals", tier: "silver", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString() },
    { id: "lib-assist", name: "Assist Ally", description: "Helping teammates when queues spike", tier: "bronze", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString() },
    { id: "lib-ops", name: "Ops Steady", description: "Consistent checklists completed on time", tier: "gold", earnedAt: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString() },
  ],
  notifications: [
    {
      id: "n-1",
      type: "xp_award",
      userId: "u-1",
      message: "Sierra Nguyen received +25 XP for On-time arrival welcome",
      meta: { xp: 25, category: "check_in" },
      createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "n-2",
      type: "badge_unlock",
      userId: "u-3",
      message: "Priya Mehta unlocked Coaching Star",
      meta: { badgeId: "b-4", tier: "gold" },
      createdAt: new Date(now - 1000 * 60 * 55).toISOString(),
    },
  ],
};

const state: StubState = structuredClone(initialState);

const optInByCampground: Record<string, OptInState> = campgrounds.reduce(
  (acc, cg) => ({
    ...acc,
    [cg.id]: {
      enabled: true,
      enabledRoles: ["owner", "manager", "front_desk", "maintenance"],
      manualAwardsAllowed: true,
    },
  }),
  {
    [defaultCampgroundId]: {
      enabled: true,
      enabledRoles: ["owner", "manager", "front_desk", "maintenance"],
      manualAwardsAllowed: true,
    },
  }
);

const delay = (ms = 40) => new Promise((res) => setTimeout(res, ms));

export function listStaff(): StaffMember[] {
  return structuredClone(state.staff);
}

export function listChallenges(): ChallengeDefinition[] {
  return structuredClone(state.challenges);
}

export function listCampgrounds(): CampgroundStub[] {
  return structuredClone(campgrounds);
}

export function getOptIn(campgroundId?: string): OptInState {
  const key = campgroundId || defaultCampgroundId;
  const value = optInByCampground[key] || optInByCampground[defaultCampgroundId];
  return structuredClone(value);
}

export function updateOptIn(payload: Partial<OptInState>, campgroundId?: string): OptInState {
  const key = campgroundId || defaultCampgroundId;
  const prev = optInByCampground[key] || getOptIn(defaultCampgroundId);
  optInByCampground[key] = { ...prev, ...payload };
  return getOptIn(key);
}

export function overrideXp(userId: string, nextTotalXp: number) {
  const staff = state.staff.find((s) => s.id === userId);
  if (staff) {
    staff.totalXp = Math.max(0, nextTotalXp);
    recordNotification({
      type: "override",
      userId,
      message: `${staff.name} XP manually set to ${staff.totalXp}`,
      meta: { nextTotalXp },
    });
  }
  return listStaff();
}

function ensureBadgeForUser(userId: string, badgeId?: string, badgeNameHint?: string) {
  if (!badgeId && !badgeNameHint) return false;
  const staff = state.staff.find((s) => s.id === userId);
  if (!staff) return false;
  const library = listBadgeLibrary();
  const badge =
    (badgeId && library.find((b) => b.id === badgeId)) ||
    (badgeNameHint && library.find((b) => b.name === badgeNameHint)) || (badgeNameHint
      ? {
        id: `earned-${Math.random().toString(36).slice(2, 8)}`,
        name: badgeNameHint,
        description: "Challenge completed",
        tier: "silver" as const,
        earnedAt: new Date().toISOString(),
      }
      : undefined);
  if (!badge) return false;
  const already = staff.badges.some((b) => b.name === badge.name || b.id === badge.id);
  if (already) return false;
  staff.badges.unshift({ ...badge, earnedAt: new Date().toISOString() });
  return true;
}

function recordNotification(payload: Omit<GamificationNotification, "id" | "createdAt"> & { createdAt?: string }) {
  const entry: GamificationNotification = {
    id: `n-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    ...payload,
  };
  state.notifications.unshift(entry);
  state.notifications = state.notifications.slice(0, 50);
  return entry;
}

export function awardManualXp(
  userId: string,
  xp: number,
  reason?: string,
  category: GamificationCategory = "manual",
  badgeId?: string,
  campgroundId?: string
) {
  const staff = state.staff.find((s) => s.id === userId);
  if (!staff) return listStaff();
  const optIn = getOptIn(campgroundId);
  const allowed = optIn.enabled && optIn.enabledRoles.includes(staff.role);
  if (!allowed) return listStaff();
  staff.totalXp = Math.max(0, staff.totalXp + xp);
  staff.weeklyXp += xp;
  staff.seasonalXp += xp;
  state.events.unshift({
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    category,
    xp,
    reason,
    createdAt: new Date().toISOString(),
  });
  recordNotification({
    type: "xp_award",
    userId,
    message: `${staff.name} received +${xp} XP${reason ? ` · ${reason}` : ""}`,
    meta: { xp, category, reason, badgeId },
  });
  if (badgeId) {
    const added = ensureBadgeForUser(userId, badgeId);
    if (added) {
      recordNotification({
        type: "badge_unlock",
        userId,
        message: `${staff.name} unlocked a badge`,
        meta: { badgeId },
      });
    }
  }
  return listStaff();
}

export function computeLevel(totalXp: number) {
  let current = levels[0];
  for (const level of levels) {
    if (totalXp >= level.minXp) current = level;
  }
  const currentIdx = levels.findIndex((l) => l.level === current.level);
  const next = levels[currentIdx + 1];
  const progressToNext = next ? (totalXp - current.minXp) / (next.minXp - current.minXp) : 1;
  return {
    level: current.level,
    minXp: current.minXp,
    nextLevel: next?.level ?? null,
    nextMinXp: next?.minXp ?? null,
    progressToNext: Math.min(1, Math.max(0, progressToNext)),
  };
}

function getRecentEvents(userId: string, limit = 6): GamificationEvent[] {
  return structuredClone(state.events.filter((evt) => evt.userId === userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit));
}

function getCategoryStats(userId: string) {
  const byCategory: Record<GamificationCategory, number> = {
    task: 0,
    maintenance: 0,
    check_in: 0,
    reservation_quality: 0,
    checklist: 0,
    review_mention: 0,
    on_time_assignment: 0,
    assist: 0,
    manual: 0,
    other: 0,
  };
  state.events.filter((e) => e.userId === userId).forEach((evt) => {
    byCategory[evt.category] = (byCategory[evt.category] || 0) + evt.xp;
  });
  return Object.entries(byCategory)
    .filter(([, xp]) => xp !== 0)
    .map(([category, xp]) => ({ category: category as GamificationCategory, xp }));
}

export async function fetchStaffDashboard(userId: string, campgroundId?: string) {
  await delay();
  const staff = state.staff.find((s) => s.id === userId) || state.staff[0];
  const level = computeLevel(staff.totalXp);
  const challengeDefs = state.challenges;
  const challengeProgress = staff.challenges.map((c) => ({
    ...c,
    challenge: challengeDefs.find((d) => d.id === c.challengeId),
  }));
  challengeProgress.forEach((c) => {
    if (c.status === "completed" && c.challenge?.rewardBadge) {
      ensureBadgeForUser(staff.id, undefined, c.challenge.rewardBadge);
    }
  });
  const optIn = getOptIn(campgroundId);
  return {
    enabled: optIn.enabled,
    allowed: optIn.enabledRoles.includes(staff.role),
    staff,
    level,
    balance: { totalXp: staff.totalXp, weeklyXp: staff.weeklyXp, seasonalXp: staff.seasonalXp },
    badges: structuredClone(staff.badges),
    recentEvents: getRecentEvents(staff.id),
    categories: getCategoryStats(staff.id),
    weeklyChallenges: challengeProgress,
    optIn,
  };
}

export async function fetchLeaderboard(window: "weekly" | "seasonal" | "all", viewerId?: string) {
  await delay();
  const key = window === "weekly" ? "weeklyXp" : window === "seasonal" ? "seasonalXp" : "totalXp";
  const ranked = [...state.staff]
    .sort((a, b) => (b as any)[key] - (a as any)[key])
    .map((s, idx) => ({
      userId: s.id,
      name: s.name,
      role: s.role,
      xp: (s as any)[key],
      rank: idx + 1,
    }));
  const viewer = viewerId ? ranked.find((r) => r.userId === viewerId) || null : null;
  return { leaderboard: ranked, viewer };
}

export async function fetchManagerSnapshot(campgroundId?: string) {
  await delay();
  const optIn = getOptIn(campgroundId);
  return {
    campgroundId: campgroundId || defaultCampgroundId,
    optIn,
    staff: listStaff(),
    challenges: listChallenges(),
    badgeLibrary: listBadgeLibrary(),
    campgrounds: listCampgrounds(),
  };
}

export function listBadgeLibrary() {
  return structuredClone(state.badgeLibrary);
}

export function upsertBadge(payload: { id?: string; name: string; description: string; tier?: GamificationBadge["tier"] }) {
  const id = payload.id || `lib-${Math.random().toString(36).slice(2, 8)}`;
  const idx = state.badgeLibrary.findIndex((b) => b.id === id);
  const badge: GamificationBadge = {
    id,
    name: payload.name,
    description: payload.description,
    tier: payload.tier,
    earnedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    state.badgeLibrary[idx] = badge;
  } else {
    state.badgeLibrary.unshift(badge);
  }
  return listBadgeLibrary();
}

export function removeBadge(id: string) {
  state.badgeLibrary = state.badgeLibrary.filter((b) => b.id !== id);
  return listBadgeLibrary();
}

export function listRecentAwards(limit = 8) {
  const staffMap = new Map(state.staff.map((s) => [s.id, s]));
  return structuredClone(
    [...state.events]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
      .map((evt) => ({
        ...evt,
        userName: staffMap.get(evt.userId)?.name || "Unknown staff",
        role: staffMap.get(evt.userId)?.role || "staff",
      }))
  );
}

export function listRecentBadgeUnlocks(limit = 8) {
  const flattened = state.staff.flatMap((s) => s.badges.map((badge) => ({ ...badge, userId: s.id, userName: s.name, role: s.role })));
  return structuredClone(
    flattened
      .sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt))
      .slice(0, limit)
  );
}

export function listNotifications(limit = 10) {
  return structuredClone([...state.notifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit));
}

export function sendGamificationNotification(payload: Omit<GamificationNotification, "id" | "createdAt"> & { createdAt?: string }) {
  return recordNotification(payload);
}

export function listHistoryEntries(limit = 12): GamificationHistoryEntry[] {
  const staffMap = new Map(state.staff.map((s) => [s.id, s]));
  const awardEntries: GamificationHistoryEntry[] = state.events.map((evt) => ({
    id: evt.id,
    type: "xp_award",
    userId: evt.userId,
    userName: staffMap.get(evt.userId)?.name,
    role: staffMap.get(evt.userId)?.role,
    xp: evt.xp,
    reason: evt.reason,
    createdAt: evt.createdAt,
  }));
  const badgeEntries: GamificationHistoryEntry[] = state.staff.flatMap((s) =>
    s.badges.map((badge) => ({
      id: `${s.id}-${badge.id}`,
      type: "badge_unlock",
      userId: s.id,
      userName: s.name,
      role: s.role,
      badgeName: badge.name,
      badgeTier: badge.tier,
      createdAt: badge.earnedAt,
    }))
  );
  const overrideEntries: GamificationHistoryEntry[] = state.notifications
    .filter((n) => n.type === "override")
    .map((n) => ({
      id: n.id,
      type: "override",
      userId: n.userId,
      userName: staffMap.get(n.userId || "")?.name,
      role: staffMap.get(n.userId || "")?.role,
      xp: n.meta?.nextTotalXp,
      createdAt: n.createdAt,
    }));

  return structuredClone(
    [...awardEntries, ...badgeEntries, ...overrideEntries]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
  );
}


