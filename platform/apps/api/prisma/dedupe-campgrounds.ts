/**
 * Deduplicate RIDB campgrounds - keeps the record with best data quality
 * Quality score = has_image + has_coords + has_city + amenity_count
 *
 * Usage: DATABASE_URL="..." npx ts-node prisma/dedupe-campgrounds.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

interface DupeGroup {
  name: string;
  state: string | null;
}

async function main() {
  console.log("Finding duplicate campground groups...\n");

  // Find all duplicate groups (same name + state)
  const dupeGroups = await prisma.$queryRaw<DupeGroup[]>`
    SELECT name, state
    FROM "Campground"
    WHERE "isExternal" = true
    GROUP BY name, state
    HAVING COUNT(*) > 1
  `;

  console.log(`Found ${dupeGroups.length} duplicate groups\n`);

  let totalDeleted = 0;

  for (const group of dupeGroups) {
    // Get all campgrounds in this group
    const campgrounds = await prisma.campground.findMany({
      where: {
        isExternal: true,
        name: group.name,
        state: group.state,
      },
      select: {
        id: true,
        name: true,
        state: true,
        city: true,
        heroImageUrl: true,
        latitude: true,
        amenities: true,
      },
    });

    if (campgrounds.length <= 1) continue;

    // Calculate quality score for each
    const scored = campgrounds.map((cg) => ({
      ...cg,
      score:
        (cg.heroImageUrl ? 10 : 0) + // Image is most valuable
        (cg.latitude ? 5 : 0) + // Coords are important
        (cg.city ? 2 : 0) + // City is nice to have
        (cg.amenities?.length || 0), // More amenities = better
    }));

    // Sort by score descending - keep the best one
    scored.sort((a, b) => b.score - a.score);

    const keeper = scored[0];
    const toDelete = scored.slice(1);

    console.log(
      `[${group.name}] in ${group.state || "NULL"}: keeping ${keeper.id} (score ${keeper.score}), deleting ${toDelete.length} dupes`,
    );

    // Delete the duplicates
    for (const dupe of toDelete) {
      await prisma.campground.delete({ where: { id: dupe.id } });
      totalDeleted++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Duplicate groups processed: ${dupeGroups.length}`);
  console.log(`Campgrounds deleted: ${totalDeleted}`);

  // Verify final count
  const finalCount = await prisma.campground.count({ where: { isExternal: true } });
  console.log(`Remaining RIDB campgrounds: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
