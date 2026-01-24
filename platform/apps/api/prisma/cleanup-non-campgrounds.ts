/**
 * Remove non-campground facilities from RIDB imports
 * These are ranger stations, trailheads, day use areas, etc.
 *
 * Usage: DATABASE_URL="..." npx ts-node prisma/cleanup-non-campgrounds.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// Patterns that indicate non-campground facilities
const NON_CAMPGROUND_PATTERNS = [
  // Administrative
  "%Ranger District%",
  "%Ranger Station%",
  "%District Office%",
  "%Administrative%",
  "%Visitor Center%",
  "%Information Center%",
  // Day use / Recreation
  "%Day Use%",
  "%Picnic Area%",
  "%Picnic Site%",
  "%Recreation Area%",
  // Water access
  "%Boat Ramp%",
  "%Boat Launch%",
  "%Fish Hatchery%",
  // Trails and routes
  "%Trailhead%",
  "%Scenic Byway%",
  "%Wilderness Area%",
  "% Trail",
  "% Trail %",
  "% Ride",
  "% Corridor",
  "%Wild and Scenic%",
  // Geographic features (without "campground" in name)
  "% Division",
];

async function main() {
  console.log("Finding non-campground facilities to remove...\n");

  // Build dynamic WHERE clause
  const patterns = NON_CAMPGROUND_PATTERNS.map((p) => `name ILIKE '${p}'`).join(" OR ");

  // Find all non-campgrounds
  const toRemove = await prisma.$queryRawUnsafe<
    { id: string; name: string; state: string | null }[]
  >(`
    SELECT id, name, state FROM "Campground"
    WHERE "isExternal" = true
      AND (${patterns} OR name ~ '^[A-Za-z ]+, [A-Z]{2}$')
  `);

  console.log(`Found ${toRemove.length} non-campground facilities:\n`);

  // Group by type for summary
  const types: Record<string, number> = {};
  for (const cg of toRemove) {
    const name = cg.name.toLowerCase();
    let type = "Other";
    if (name.includes("ranger district")) type = "Ranger District";
    else if (name.includes("ranger station")) type = "Ranger Station";
    else if (name.includes("trailhead")) type = "Trailhead";
    else if (name.includes("day use")) type = "Day Use Area";
    else if (name.includes("wilderness")) type = "Wilderness Area";
    else if (name.includes("scenic byway")) type = "Scenic Byway";
    else if (name.includes("picnic")) type = "Picnic Area";
    else if (name.includes("boat")) type = "Boat Ramp/Launch";
    else if (name.includes("recreation area")) type = "Recreation Area";
    else if (name.includes("visitor center") || name.includes("information"))
      type = "Visitor Center";
    else if (name.match(/^[a-z ]+, [a-z]{2}$/i)) type = "City/Location Only";
    types[type] = (types[type] || 0) + 1;
  }

  console.log("By type:");
  for (const [type, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log();

  // Delete them
  let deleted = 0;
  for (const cg of toRemove) {
    await prisma.campground.delete({ where: { id: cg.id } });
    deleted++;
    if (deleted % 50 === 0) {
      console.log(`Deleted ${deleted}/${toRemove.length}...`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Deleted: ${deleted} non-campground facilities`);

  // Final count
  const remaining = await prisma.campground.count({ where: { isExternal: true } });
  console.log(`Remaining RIDB campgrounds: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(console.error);
