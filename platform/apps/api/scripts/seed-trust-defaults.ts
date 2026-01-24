/**
 * Seed default permission rules and approval policies.
 *
 * Examples:
 *  - Global defaults: pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 *  - Specific camp: SEED_CAMP_ID=sandbox-camp pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 *  - All camps: SEED_CAMP_ID=all pnpm ts-node --project tsconfig.json platform/apps/api/scripts/seed-trust-defaults.ts
 */
import { Prisma, PrismaClient, PermissionEffect, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
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
    {
      role: UserRole.manager,
      resource: "privacy",
      action: "write",
      effect: PermissionEffect.allow,
    },
    { role: UserRole.owner, resource: "privacy", action: "read", effect: PermissionEffect.allow },
    { role: UserRole.manager, resource: "privacy", action: "read", effect: PermissionEffect.allow },
    // Permissions admin
    {
      role: UserRole.owner,
      resource: "permissions",
      action: "write",
      effect: PermissionEffect.allow,
    },
    {
      role: UserRole.owner,
      resource: "permissions",
      action: "read",
      effect: PermissionEffect.allow,
    },
    {
      role: UserRole.manager,
      resource: "permissions",
      action: "read",
      effect: PermissionEffect.allow,
    },
    // Default deny for export PII for non-owners
    {
      role: UserRole.manager,
      resource: "privacy",
      action: "export_pii",
      effect: PermissionEffect.deny,
    },
    {
      role: UserRole.front_desk,
      resource: "privacy",
      action: "export_pii",
      effect: PermissionEffect.deny,
    },
    {
      role: UserRole.readonly,
      resource: "privacy",
      action: "export_pii",
      effect: PermissionEffect.deny,
    },
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
            action: rule.action,
          },
        },
        create: { ...rule, campgroundId: campId, fields: [] },
        update: { effect: rule.effect, fields: [] },
      });
    }
  }

  const policies: Array<{
    action: string;
    name: string;
    description: string;
    approverRoles: UserRole[];
    appliesTo: string[];
  }> = [
    {
      action: "export_pii",
      name: "Export PII",
      description: "PII export requires owner approval",
      approverRoles: [UserRole.owner],
      appliesTo: ["export_pii"],
    },
    {
      action: "refund_over_500",
      name: "Refund Over $500",
      description: "High-value refund",
      approverRoles: [UserRole.owner, UserRole.manager],
      appliesTo: ["refund_over_500"],
    },
    {
      action: "role_change_owner",
      name: "Owner Role Change",
      description: "Protect ownership changes",
      approverRoles: [UserRole.owner],
      appliesTo: ["role_change_owner"],
    },
    {
      action: "subject_request",
      name: "Subject Request",
      description: "Data subject request confirmation",
      approverRoles: [UserRole.owner],
      appliesTo: ["subject_request"],
    },
  ];

  for (const campId of targetCampIds) {
    for (const policy of policies) {
      const where: Prisma.ApprovalPolicyWhereUniqueInput = {
        campgroundId_action: { campgroundId: campId, action: policy.action },
      };
      await prisma.approvalPolicy.upsert({
        where,
        create: {
          id: randomUUID(),
          campgroundId: campId,
          action: policy.action,
          name: policy.name,
          description: policy.description,
          approverRoles: policy.approverRoles,
          appliesTo: policy.appliesTo,
        },
        update: {
          name: policy.name,
          description: policy.description,
          approverRoles: policy.approverRoles,
          appliesTo: policy.appliesTo,
        },
      });
    }
  }

  console.log(
    `Seeded permission rules and approval policies for campgrounds: ${targetCampIds.join(", ") || "none"}.`,
  );
}

async function resolveCampIds(seedCampId: string | null): Promise<string[]> {
  const camps = await prisma.campground.findMany({ select: { id: true } });
  if (seedCampId === "all" || seedCampId === null) {
    return camps.map((c) => c.id); // global defaults => apply to all camps
  }
  const exists = camps.find((c) => c.id === seedCampId);
  if (!exists) {
    throw new Error(
      `Campground ${seedCampId} not found. Set SEED_CAMP_ID=all or omit for global defaults.`,
    );
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
