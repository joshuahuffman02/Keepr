import type { PlatformRole, UserRole } from "@prisma/client";

export type AuthCampgroundSummary = {
  id: string;
  name: string;
  slug: string;
};

export type AuthMembership = {
  id: string;
  campgroundId: string;
  role: UserRole | null;
  campground?: AuthCampgroundSummary;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  region: string | null;
  platformRole: PlatformRole | null;
  platformRegion: string | null;
  platformActive: boolean;
  ownershipRoles: string[];
  role: UserRole | null;
  memberships: AuthMembership[];
};
