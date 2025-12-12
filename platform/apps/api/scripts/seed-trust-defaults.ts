/**
 * Seed default permission rules and approval policies.
 *
 * Examples:
 *  - Global defaults: pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 *  - Specific camp: SEED_CAMP_ID=sandbox-camp pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 *  - All camps: SEED_CAMP_ID=all pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 */
import { PrismaClient, PermissionEffect, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });
const SEED_CAMP_ID = process.env.SEED_CAMP_ID ?? null; // null = global defaults; "all" = every campground; or a specific campground id

async function main() {
  const globalRules = [
    // Audit
    { role: UserRole.owner, resource: "audit", action: "read", effect: PermissionEffect.allow },
    { role: UserRole.owner, resource: "audit", action: "export", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "audit", action: "read", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "audit", action: "export", effect: PermissionEffect.allow },
    // Privacy
    { role: UserRole.owner, resource: "privacy", action: "write", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "privacy", action: "write", effect: PermissionEffect.allow },
    { role: UserRole.owner, resource: "privacy", action: "read", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "privacy", action: "read", effect: PermissionEffect.allow },
    // Permissions admin
    { role: UserRole.owner, resource: "permissions", action: "write", effect: PermissionEffect.allow },
    { role: UserRole.owner, resource: "permissions", action: "read", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "permissions", action: "read", effect: PermissionEffect.allow },
    // Default deny for export PII for non-owners
    { role: UserRole.manager, resource: "privacy", action: "export_pii", effect: PermissionEffect.deny },
    { role: UserRole.front_desk, resource: "privacy", action: "export_pii", effect: PermissionEffect.deny },
    { role: UserRole.readonly, resource: "privacy", action: "export_pii", effect: PermissionEffect.deny },
  ];

  const targetCampIds = await resolveCampIds(SEED_CAMP_ID);

  for (const campId of targetCampIds) {
    for (const rule of globalRules) {
      await prisma.permissionRule.upsert({
        where: {
          campgroundId_role_resource_action: {
            campgroundId: campId,
            role: rule.role,
            resource: rule.resource,
            action: rule.action
          }
        },
        create: { ...rule, campgroundId: campId, fields: [] },
        update: { effect: rule.effect, fields: [] }
      });
    }
  }

  const policies = [
    { action: "export_pii", resource: "privacy", approverRoles: [UserRole.owner], rationale: "PII export requires owner approval" },
    { action: "refund_over_500", resource: "payments", approverRoles: [UserRole.owner, UserRole.manager], rationale: "High-value refund" },
    { action: "role_change_owner", resource: "permissions", approverRoles: [UserRole.owner], rationale: "Protect ownership changes" },
    { action: "subject_request", resource: "privacy", approverRoles: [UserRole.owner], rationale: "Data subject request confirmation" },
  ];

  for (const campId of targetCampIds) {
    for (const policy of policies) {
      await prisma.approvalPolicy.upsert({
        where: { campgroundId_action: { campgroundId: campId, action: policy.action } } as any,
        create: { ...policy, campgroundId: campId },
        update: { approverRoles: policy.approverRoles, rationale: policy.rationale }
      });
    }
  }

  console.log(`Seeded permission rules and approval policies for campgrounds: ${targetCampIds.join(", ") || "none"}.`);
}

async function resolveCampIds(seedCampId: string | null): Promise<string[]> {
  const camps = await prisma.campground.findMany({ select: { id: true } });
  if (seedCampId === "all" || seedCampId === null) {
    return camps.map((c) => c.id); // global defaults => apply to all camps
  }
  const exists = camps.find((c) => c.id === seedCampId);
  if (!exists) {
    throw new Error(`Campground ${seedCampId} not found. Set SEED_CAMP_ID=all or omit for global defaults.`);
  }
  return [seedCampId];
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

