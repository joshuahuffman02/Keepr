/**
 * Fetch missing images from RIDB API for campgrounds without hero images
 * Extracts RIDB facility ID from slug and fetches media
 *
 * Usage: RIDB_API_KEY="..." DATABASE_URL="..." npx ts-node prisma/fetch-ridb-images.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const RIDB_API_KEY = process.env.RIDB_API_KEY;
const RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1";

if (!RIDB_API_KEY) {
  console.error("RIDB_API_KEY environment variable is required");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract RIDB facility ID from slug (e.g., "brasstown-falls-243858" -> "243858")
function extractFacilityId(slug: string): string | null {
  const match = slug.match(/-(\d+)$/);
  return match ? match[1] : null;
}

interface RidbMedia {
  MediaType: string;
  URL: string;
  Title?: string;
  Width?: number;
  Height?: number;
}

async function fetchFacilityMedia(facilityId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${RIDB_BASE_URL}/facilities/${facilityId}/media?apikey=${RIDB_API_KEY}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      console.error(`RIDB API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const media: RidbMedia[] = data.RECDATA || [];

    // Find best image - prefer larger images
    const images = media
      .filter((m) => m.MediaType === "Image" && m.URL)
      .sort((a, b) => (b.Width || 0) * (b.Height || 0) - (a.Width || 0) * (a.Height || 0));

    return images[0]?.URL || null;
  } catch (error) {
    console.error(`Failed to fetch media: ${error}`);
    return null;
  }
}

async function main() {
  console.log("Fetching campgrounds without images...\n");

  // Use raw SQL for null checks which are tricky in Prisma
  const campgrounds = await prisma.$queryRaw<{ id: string; name: string; slug: string }[]>`
    SELECT id, name, slug FROM "Campground"
    WHERE "isExternal" = true
      AND "heroImageUrl" IS NULL
      AND slug IS NOT NULL
    LIMIT 500
  `;

  console.log(`Found ${campgrounds.length} campgrounds without images\n`);

  let updated = 0;
  let noMedia = 0;
  let failed = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const cg = campgrounds[i];
    const facilityId = cg.slug ? extractFacilityId(cg.slug) : null;

    process.stdout.write(
      `[${i + 1}/${campgrounds.length}] ${cg.name.substring(0, 35).padEnd(35)} `,
    );

    if (!facilityId) {
      console.log(`- No RIDB ID`);
      failed++;
      continue;
    }

    const imageUrl = await fetchFacilityMedia(facilityId);

    if (imageUrl) {
      await prisma.campground.update({
        where: { id: cg.id },
        data: { heroImageUrl: imageUrl },
      });
      console.log(`-> Got image`);
      updated++;
    } else {
      console.log(`- No media`);
      noMedia++;
    }

    // Rate limit - RIDB allows 1000/hour, so ~3/second is safe
    await sleep(350);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Images added: ${updated}`);
  console.log(`No media found: ${noMedia}`);
  console.log(`Failed/skipped: ${failed}`);

  // Check remaining
  const remaining = await prisma.campground.count({
    where: { isExternal: true, heroImageUrl: null },
  });
  console.log(`Still without images: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(console.error);
