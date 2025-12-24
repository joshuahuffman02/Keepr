/**
 * Role-based default menu configurations
 * These are the default pinned pages for each role
 */

export const ROLE_DEFAULT_MENUS: Record<string, string[]> = {
  // Front desk staff - focus on daily operations
  front_desk: [
    "/dashboard",
    "/check-in-out",
    "/booking",
    "/calendar",
    "/messages",
    "/pos",
    "/waitlist",
    "/guests",
  ],

  // Manager - operations + reporting + some management
  manager: [
    "/dashboard",
    "/calendar",
    "/reservations",
    "/guests",
    "/messages",
    "/reports",
    "/ledger",
    "/dashboard/management",
    "/gamification",
  ],

  // Owner/Admin - high-level view + settings
  owner: [
    "/dashboard",
    "/calendar",
    "/reservations",
    "/guests",
    "/messages",
    "/reports",
    "/ledger",
    "/dashboard/settings",
    "/gamification",
  ],

  // Finance role - focus on money
  finance: [
    "/dashboard",
    "/ledger",
    "/payouts",
    "/disputes",
    "/reports",
    "/billing/repeat-charges",
    "/gift-cards",
  ],

  // Maintenance staff
  maintenance: [
    "/dashboard",
    "/maintenance",
    "/operations/tasks",
  ],

  // Admin (platform level)
  admin: [
    "/dashboard",
    "/calendar",
    "/reservations",
    "/reports",
    "/admin",
    "/admin/support",
    "/dashboard/settings",
  ],
};

/**
 * Get default menu for a role, with optional campgroundId for dynamic pages
 */
export function getDefaultMenuForRole(
  role: string,
  campgroundId?: string
): string[] {
  const menu = ROLE_DEFAULT_MENUS[role] || ROLE_DEFAULT_MENUS.front_desk;

  // If we have a campgroundId, add some dynamic pages
  if (campgroundId) {
    const dynamicPages: string[] = [];

    // Add site map for most roles
    if (["front_desk", "manager", "owner", "admin"].includes(role)) {
      dynamicPages.push(`/campgrounds/${campgroundId}/map`);
    }

    // Add housekeeping for front desk and maintenance
    if (["front_desk", "maintenance"].includes(role)) {
      dynamicPages.push(`/campgrounds/${campgroundId}/housekeeping`);
    }

    // Add staff pages for ops roles
    if (["manager", "owner", "admin"].includes(role)) {
      dynamicPages.push(`/campgrounds/${campgroundId}/staff/timeclock`);
    }

    return [...menu, ...dynamicPages];
  }

  return menu;
}

/**
 * Infer the best role from user permissions
 */
export function inferRoleFromPermissions(
  permissions: Record<string, boolean>,
  platformRole?: string | null
): string {
  if (platformRole) {
    return "admin";
  }

  // Check for owner-level permissions
  if (permissions.settingsWrite && permissions.usersWrite) {
    return "owner";
  }

  // Check for manager-level permissions
  if (permissions.financeRead || permissions.reportsRead) {
    return "manager";
  }

  // Check for finance role
  if (permissions.financeRead && !permissions.operationsWrite) {
    return "finance";
  }

  // Check for maintenance role
  if (permissions.operationsWrite && !permissions.financeRead) {
    return "maintenance";
  }

  // Default to front desk
  return "front_desk";
}
