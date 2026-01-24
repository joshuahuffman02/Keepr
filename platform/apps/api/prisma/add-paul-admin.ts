/**
 * One-time script to add Paul as a platform admin
 * Run with: npx ts-node prisma/add-paul-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "pomdal@gmail.com";
  const tempPassword = "CampAdmin2024!";

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Update to platform admin if not already
    const updated = await prisma.user.update({
      where: { email },
      data: {
        platformRole: "platform_admin",
        platformActive: true,
        isActive: true,
      },
    });
    console.log(`Updated ${email} to platform_admin`);
    console.log(`User ID: ${updated.id}`);
    return;
  }

  // Create new user
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Paul",
      lastName: "Admin",
      platformRole: "platform_admin",
      platformActive: true,
      mustChangePassword: true,
      isActive: true,
    },
  });

  console.log("Created platform admin for Paul:");
  console.log(`  Email: ${email}`);
  console.log(`  Temp Password: ${tempPassword}`);
  console.log(`  User ID: ${user.id}`);
  console.log("\nPaul should change this password on first login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
