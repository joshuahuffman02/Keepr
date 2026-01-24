#!/usr/bin/env node
/**
 * Backfill RIDB Campground Locations
 *
 * Updates existing RIDB-imported campgrounds with missing city/state data.
 * Fetches from RIDB API with full=true to get address information.
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1";
const RATE_LIMIT_DELAY_MS = 1000; // 1 second between requests

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = process.env.RIDB_API_KEY;
  const connectionString = process.env.DATABASE_URL;

  if (!apiKey || !connectionString) {
    console.error("Error: RIDB_API_KEY and DATABASE_URL required");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("Backfilling RIDB campground locations...\n");

  // Find campgrounds with missing city/state
  const campgrounds = await prisma.campground.findMany({
    where: {
      seededDataSource: "recreation_gov",
      seededDataSourceId: { not: null },
      OR: [{ city: null }, { state: null }],
    },
    select: {
      id: true,
      name: true,
      seededDataSourceId: true,
    },
  });

  console.log(`Found ${campgrounds.length} campgrounds with missing location data\n`);

  let updated = 0;
  let failed = 0;

  for (const camp of campgrounds) {
    try {
      // Fetch facility from RIDB
      const res = await fetch(`${RIDB_BASE_URL}/facilities/${camp.seededDataSourceId}?full=true`, {
        headers: { apikey: apiKey },
      });

      if (!res.ok) {
        console.log(`  Skip ${camp.name}: RIDB returned ${res.status}`);
        failed++;
        continue;
      }

      const facility = await res.json();
      const addr = facility.FACILITYADDRESS?.[0];

      if (!addr || (!addr.City && !addr.AddressStateCode)) {
        console.log(`  Skip ${camp.name}: No address in RIDB`);
        continue;
      }

      // Update the campground
      await prisma.campground.update({
        where: { id: camp.id },
        data: {
          city: addr.City || null,
          state: addr.AddressStateCode || null,
          address1: addr.FacilityStreetAddress1 || null,
          postalCode: addr.PostalCode || null,
        },
      });

      console.log(`  Updated: ${camp.name} -> ${addr.City}, ${addr.AddressStateCode}`);
      updated++;

      await sleep(RATE_LIMIT_DELAY_MS);
    } catch (err) {
      console.error(`  Error updating ${camp.name}:`, err.message);
      failed++;
    }
  }

  console.log("\n======================");
  console.log("Backfill Complete");
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${campgrounds.length - updated - failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
