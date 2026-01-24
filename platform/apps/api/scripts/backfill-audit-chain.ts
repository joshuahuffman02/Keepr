/**
 * Backfill AuditLog chainHash/prevHash/retentionAt for existing rows.
 * Usage: pnpm ts-node --project tsconfig.json platform/apps/api/scripts/backfill-audit-chain.ts
 */
import { AuditLog, PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

function computeHash(row: AuditLog, prevHash: string | null) {
  const payload = {
    campgroundId: row.campgroundId,
    actorId: row.actorId,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    before: row.before ?? null,
    after: row.after ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: row.createdAt.toISOString(),
    prevHash,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function main() {
  const camps = await prisma.campground.findMany({ select: { id: true } });
  let updated = 0;

  for (const camp of camps) {
    const rows = await prisma.auditLog.findMany({
      where: { campgroundId: camp.id },
      orderBy: { createdAt: "asc" },
    });

    let prevHash: string | null = null;
    for (const row of rows) {
      const shouldFill = !row.chainHash || row.prevHash !== prevHash;
      if (!shouldFill) {
        prevHash = row.chainHash;
        continue;
      }
      const chainHash = computeHash(row, prevHash);
      const retentionAt = row.retentionAt ?? null;
      await prisma.auditLog.update({
        where: { id: row.id },
        data: { prevHash, chainHash, retentionAt },
      });
      prevHash = chainHash;
      updated += 1;
    }
  }

  console.log(
    `Backfill complete. Updated ${updated} audit rows across ${camps.length} campgrounds.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
