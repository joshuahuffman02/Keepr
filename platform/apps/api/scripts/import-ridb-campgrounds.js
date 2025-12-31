#!/usr/bin/env node
/**
 * RIDB Campground Import Script
 *
 * Imports campground data from Recreation.gov's RIDB API
 * Complies with RIDB API Access Agreement:
 * - Rate limited to 900 requests/hour (under 1,000 limit)
 * - Stores source attribution (seededDataSource: 'recreation_gov')
 * - Preserves original FacilityID for traceability
 *
 * Usage:
 *   DATABASE_URL=... RIDB_API_KEY=your-key node scripts/import-ridb-campgrounds.js
 *
 * Options:
 *   --limit=100     Import only first N campgrounds (for testing)
 *   --state=CA      Import only campgrounds in specified state
 *   --dry-run       Preview without inserting to database
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Initialize Prisma with adapter (Prisma 7 requirement)
const connectionString = process.env.DATABASE_URL;
let prisma;

function initPrisma() {
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is required for database operations");
    console.error("For dry-run mode, you can skip this.");
    return null;
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Configuration
const RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1";
const RATE_LIMIT_DELAY_MS = 4000; // 4 seconds between requests (900/hour)
const PAGE_SIZE = 50; // RIDB max is 50

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { dryRun: false };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      result.limit = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--state=")) {
      result.state = arg.split("=")[1].toUpperCase();
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    }
  }

  return result;
}

// Sleep helper for rate limiting
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate URL-friendly slug from name
function generateSlug(name, facilityId) {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);

  // Append facility ID suffix for uniqueness
  return `${baseSlug}-${facilityId}`;
}

// Extract amenities from activities
function extractAmenities(activities) {
  const amenityMap = {
    CAMPING: "camping",
    "RV CAMPING": "rv_hookups",
    "TENT CAMPING": "tent_sites",
    HIKING: "hiking",
    FISHING: "fishing",
    SWIMMING: "swimming",
    BOATING: "boating",
    PICNICKING: "picnic_area",
    "WILDLIFE VIEWING": "wildlife",
    BIKING: "biking",
    "HORSEBACK RIDING": "horseback",
    HUNTING: "hunting",
    "CROSS COUNTRY SKIING": "skiing",
    SNOWMOBILING: "snowmobiling",
    "OFF HIGHWAY VEHICLE": "atv",
    CLIMBING: "climbing",
    "WATER SPORTS": "water_sports",
    KAYAKING: "kayaking",
    CANOEING: "canoeing",
    PADDLING: "paddling",
  };

  return (activities || [])
    .map((a) => amenityMap[a.ActivityName?.toUpperCase()])
    .filter((a) => !!a);
}

// Fetch facilities from RIDB API
async function fetchFacilities(apiKey, offset, state) {
  const params = new URLSearchParams({
    limit: PAGE_SIZE.toString(),
    offset: offset.toString(),
    activity: "CAMPING", // Only camping facilities
  });

  if (state) {
    params.append("state", state);
  }

  const url = `${RIDB_BASE_URL}/facilities?${params}`;

  console.log(`  Fetching: offset=${offset}${state ? ` state=${state}` : ""}`);

  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`RIDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Transform RIDB facility to our Campground format
function transformFacility(facility, organizationId) {
  const address = facility.FACILITYADDRESS?.[0];
  const photos =
    facility.MEDIA?.filter((m) => m.MediaType === "Image").map((m) => m.URL) ||
    [];
  const heroImage = photos[0] || null;

  return {
    organizationId,
    name: facility.FacilityName,
    slug: generateSlug(facility.FacilityName, facility.FacilityID),
    description: facility.FacilityDescription || null,
    isExternal: true, // These are external campgrounds we don't manage
    isBookable: false, // Can't book through us yet
    externalUrl: facility.FacilityReservationURL || null,
    nonBookableReason: "Book directly on Recreation.gov",

    // Claim status - all imported campgrounds start unclaimed
    claimStatus: "unclaimed",
    seededDataSource: "recreation_gov",
    seededDataSourceId: facility.FacilityID,
    seededAt: new Date(),

    // Location
    city: address?.City || null,
    state: address?.AddressStateCode || null,
    country: address?.AddressCountryCode || "USA",
    address1: address?.FacilityStreetAddress1 || null,
    address2: address?.FacilityStreetAddress2 || null,
    postalCode: address?.PostalCode || null,
    latitude: facility.FacilityLatitude || null,
    longitude: facility.FacilityLongitude || null,

    // Contact
    phone: facility.FacilityPhone || null,
    email: facility.FacilityEmail || null,
    website: facility.FacilityReservationURL || null,

    // Public listing
    amenities: extractAmenities(facility.ACTIVITY),
    photos,
    heroImageUrl: heroImage,
    isPublished: true, // Make visible on public marketplace

    // Provenance for audit trail
    provenance: {
      source: "ridb",
      facilityId: facility.FacilityID,
      importedAt: new Date().toISOString(),
      lastUpdated: facility.LastUpdatedDate,
      organizations: facility.ORGANIZATION?.map((o) => o.OrgName) || [],
    },
  };
}

// Main import function
async function importCampgrounds() {
  const apiKey = process.env.RIDB_API_KEY;
  if (!apiKey) {
    console.error("Error: RIDB_API_KEY environment variable is required");
    console.error(
      "Usage: RIDB_API_KEY=your-key node scripts/import-ridb-campgrounds.js"
    );
    process.exit(1);
  }

  const { limit, state, dryRun } = parseArgs();

  console.log("RIDB Campground Import");
  console.log("======================");
  console.log(`Mode: ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}`);
  if (limit) console.log(`Limit: ${limit} campgrounds`);
  if (state) console.log(`State filter: ${state}`);
  console.log("");

  // Initialize Prisma only for live mode
  if (!dryRun) {
    prisma = initPrisma();
    if (!prisma) {
      process.exit(1);
    }
  }

  // Get or create a placeholder organization for imported campgrounds
  let orgId;
  if (!dryRun) {
    const org = await prisma.organization.upsert({
      where: { slug: "ridb-imported" },
      update: {},
      create: {
        name: "RIDB Imported Campgrounds",
        slug: "ridb-imported",
        billingEmail: "imports@campreserv.com",
      },
    });
    orgId = org.id;
    console.log(`Using organization: ${org.name} (${orgId})`);
  } else {
    orgId = "dry-run-org-id";
  }

  // Fetch first page to get total count
  console.log("\nFetching campgrounds from RIDB...");
  const firstPage = await fetchFacilities(apiKey, 0, state);
  const totalAvailable = firstPage.METADATA.RESULTS.TOTAL_COUNT;
  const totalToImport = limit ? Math.min(limit, totalAvailable) : totalAvailable;

  console.log(`Total available: ${totalAvailable}`);
  console.log(`Will import: ${totalToImport}`);
  console.log("");

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  // Process first page
  for (const facility of firstPage.RECDATA) {
    if (limit && imported >= limit) break;

    try {
      const data = transformFacility(facility, orgId);

      if (dryRun) {
        console.log(
          `  [DRY RUN] Would import: ${data.name} (${facility.FacilityID})`
        );
      } else {
        // Check if already imported
        const existing = await prisma.campground.findFirst({
          where: {
            seededDataSource: "recreation_gov",
            seededDataSourceId: facility.FacilityID,
          },
        });

        if (existing) {
          console.log(`  Skipping (exists): ${data.name}`);
          skipped++;
          continue;
        }

        // Check for slug conflict
        const slugExists = await prisma.campground.findUnique({
          where: { slug: data.slug },
        });

        if (slugExists) {
          // Append random suffix
          data.slug = `${data.slug}-${Date.now().toString(36)}`;
        }

        await prisma.campground.create({ data });
        console.log(`  Imported: ${data.name}`);
      }

      imported++;
    } catch (err) {
      console.error(`  Error importing ${facility.FacilityName}:`, err.message);
      errors++;
    }
  }

  // Fetch remaining pages
  offset = PAGE_SIZE;
  while (offset < totalToImport && (!limit || imported < limit)) {
    await sleep(RATE_LIMIT_DELAY_MS); // Rate limiting

    try {
      const page = await fetchFacilities(apiKey, offset, state);

      for (const facility of page.RECDATA) {
        if (limit && imported >= limit) break;

        try {
          const data = transformFacility(facility, orgId);

          if (dryRun) {
            console.log(
              `  [DRY RUN] Would import: ${data.name} (${facility.FacilityID})`
            );
          } else {
            const existing = await prisma.campground.findFirst({
              where: {
                seededDataSource: "recreation_gov",
                seededDataSourceId: facility.FacilityID,
              },
            });

            if (existing) {
              console.log(`  Skipping (exists): ${data.name}`);
              skipped++;
              continue;
            }

            const slugExists = await prisma.campground.findUnique({
              where: { slug: data.slug },
            });

            if (slugExists) {
              data.slug = `${data.slug}-${Date.now().toString(36)}`;
            }

            await prisma.campground.create({ data });
            console.log(`  Imported: ${data.name}`);
          }

          imported++;
        } catch (err) {
          console.error(
            `  Error importing ${facility.FacilityName}:`,
            err.message
          );
          errors++;
        }
      }

      offset += PAGE_SIZE;
    } catch (err) {
      console.error(`Error fetching page at offset ${offset}:`, err.message);
      errors++;
      offset += PAGE_SIZE; // Skip to next page on error
    }
  }

  // Summary
  console.log("\n======================");
  console.log("Import Complete");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (prisma) {
    await prisma.$disconnect();
  }
}

// Run
importCampgrounds().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
