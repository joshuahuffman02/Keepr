/**
 * Add demo users: Linda (front desk) and John (maintenance)
 * Run: npx tsx prisma/seed-demo-users.ts
 */

import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Adding demo users...\n");

  const password = await bcrypt.hash("password123", 12);

  // Create Linda (front desk)
  const linda = await prisma.user.upsert({
    where: { email: "lsthesing@gmail.com" },
    update: {
      passwordHash: password,
      isActive: true,
      firstName: "Linda",
      lastName: "Thesing"
    },
    create: {
      email: "lsthesing@gmail.com",
      passwordHash: password,
      firstName: "Linda",
      lastName: "Thesing",
      isActive: true
    }
  });
  console.log(`Created/updated user: Linda Thesing (${linda.email})`);

  // Create John (maintenance)
  const john = await prisma.user.upsert({
    where: { email: "jthesing1@gmail.com" },
    update: {
      passwordHash: password,
      isActive: true,
      firstName: "John",
      lastName: "Thesing"
    },
    create: {
      email: "jthesing1@gmail.com",
      passwordHash: password,
      firstName: "John",
      lastName: "Thesing",
      isActive: true
    }
  });
  console.log(`Created/updated user: John Thesing (${john.email})`);

  // Get only the main demo campgrounds (Keepr branded ones)
  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [
        { slug: { startsWith: "camp-everyday" } },
        { slug: "sunset-sands-resort" },
        { slug: "blueberry-hill-camp" },
        { slug: "redwood-ridge-hideout" }
      ]
    },
    select: { id: true, name: true }
  });

  console.log(`\nAdding memberships to ${campgrounds.length} demo campgrounds...`);

  for (const cg of campgrounds) {
    // Linda - front desk
    await prisma.campgroundMembership.upsert({
      where: {
        userId_campgroundId: { userId: linda.id, campgroundId: cg.id }
      },
      update: { role: UserRole.front_desk },
      create: {
        campgroundId: cg.id,
        userId: linda.id,
        role: UserRole.front_desk
      }
    });

    // John - maintenance
    await prisma.campgroundMembership.upsert({
      where: {
        userId_campgroundId: { userId: john.id, campgroundId: cg.id }
      },
      update: { role: UserRole.maintenance },
      create: {
        campgroundId: cg.id,
        userId: john.id,
        role: UserRole.maintenance
      }
    });

    console.log(`  ${cg.name}: Linda (front_desk), John (maintenance)`);
  }

  console.log("\nDemo users created successfully!");
  console.log("Password for both: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
