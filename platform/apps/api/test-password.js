const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function testPassword() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "admin@keeprstay.com" },
      select: { email: true, passwordHash: true },
    });

    if (!user) {
      console.log("User not found!");
      return;
    }

    console.log(`User: ${user.email}`);
    console.log(`Password hash starts with: ${user.passwordHash.substring(0, 10)}...`);

    const testPassword = "password123";
    const matches = await bcrypt.compare(testPassword, user.passwordHash);

    console.log(`\nTesting password "${testPassword}": ${matches ? "MATCH" : "NO MATCH"}`);

    if (!matches) {
      console.log("\nWARNING: Password does not match! Need to reset user password.");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();
