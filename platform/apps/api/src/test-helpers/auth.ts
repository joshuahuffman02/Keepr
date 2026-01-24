import type { AuthMembership, AuthUser } from "../auth/auth.types";

const defaultMembership: AuthMembership = {
  id: "membership-1",
  campgroundId: "campground-1",
  role: "owner",
  campground: {
    id: "campground-1",
    name: "Test Campground",
    slug: "test-campground",
  },
};

const defaultUser: AuthUser = {
  id: "user-1",
  email: "user@example.com",
  firstName: "Test",
  lastName: "User",
  region: null,
  platformRole: null,
  platformRegion: null,
  platformActive: true,
  ownershipRoles: [],
  role: "owner",
  memberships: [defaultMembership],
};

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const buildAuthMembership = (overrides: Partial<AuthMembership> = {}): AuthMembership => ({
  ...defaultMembership,
  ...overrides,
  campground: hasOwn(overrides, "campground") ? overrides.campground : defaultMembership.campground,
});

export const buildAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  ...defaultUser,
  ...overrides,
  memberships: hasOwn(overrides, "memberships")
    ? (overrides.memberships ?? [])
    : defaultUser.memberships,
});
