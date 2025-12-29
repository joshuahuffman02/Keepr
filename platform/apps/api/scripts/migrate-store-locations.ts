/**
 * Migration script: Create default store locations for existing campgrounds
 *
 * This script:
 * 1. Creates a "Main Store" location for each campground that doesn't have one
 * 2. Sets it as the default location and enables online order acceptance
 * 3. Links existing POS terminals to the default location
 *
 * Run with: npx tsx scripts/migrate-store-locations.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Starting store location migration...\n");

    // Get all campgrounds
    const campgrounds = await prisma.campground.findMany({
        select: {
            id: true,
            name: true,
            storeLocations: {
                select: { id: true, isDefault: true },
            },
            posTerminals: {
                select: { id: true, locationId: true },
            },
        },
    });

    console.log(`Found ${campgrounds.length} campgrounds to process\n`);

    let created = 0;
    let skipped = 0;
    let terminalsLinked = 0;

    for (const cg of campgrounds) {
        // Check if campground already has a default location
        const hasDefault = cg.storeLocations.some((l) => l.isDefault);

        if (hasDefault) {
            console.log(`${cg.name}: Already has default location, skipping`);
            skipped++;
            continue;
        }

        // Create default location
        const location = await prisma.storeLocation.create({
            data: {
                campgroundId: cg.id,
                name: "Main Store",
                code: "MAIN",
                type: "physical",
                isDefault: true,
                isActive: true,
                acceptsOnline: true,
                sortOrder: 0,
            },
        });

        console.log(`+ ${cg.name}: Created default location "${location.name}"`);
        created++;

        // Link unassigned terminals to the new location
        const unassignedTerminals = cg.posTerminals.filter((t) => !t.locationId);
        if (unassignedTerminals.length > 0) {
            await prisma.posTerminal.updateMany({
                where: {
                    id: { in: unassignedTerminals.map((t) => t.id) },
                },
                data: {
                    locationId: location.id,
                },
            });
            console.log(`  → Linked ${unassignedTerminals.length} terminals to location`);
            terminalsLinked += unassignedTerminals.length;
        }
    }

    console.log("\n--- Migration Summary ---");
    console.log(`Locations created: ${created}`);
    console.log(`Campgrounds skipped (already had default): ${skipped}`);
    console.log(`Terminals linked: ${terminalsLinked}`);
    console.log("\nMigration complete!");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
