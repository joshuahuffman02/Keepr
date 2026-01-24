const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function run() {
  // Use PLATFORM_DATABASE_URL or DATABASE_URL
  const connStr = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) {
    console.error("No database URL found");
    process.exit(1);
  }
  console.log("Connecting to database...");

  const adapter = new PrismaPg({ connectionString: connStr });
  const prisma = new PrismaClient({ adapter });

  // Get existing users
  const users = await prisma.user.findMany({
    take: 5,
    select: { email: true, firstName: true, platformRole: true },
    where: { isActive: true },
  });
  console.log(
    "Existing users:",
    users.map((u) => u.email),
  );

  // Create or update an owner user
  const password = await bcrypt.hash("test1234", 12);
  const owner = await prisma.user.upsert({
    where: { email: "testowner@test.com" },
    update: { passwordHash: password, isActive: true },
    create: {
      email: "testowner@test.com",
      passwordHash: password,
      firstName: "Test",
      lastName: "Owner",
      isActive: true,
    },
  });
  console.log("Created/updated owner:", owner.email);

  // Get campground
  const campground = await prisma.campground.findFirst({
    where: { slug: "keepr-riverbend" },
  });
  if (campground) {
    await prisma.campgroundMembership.upsert({
      where: {
        userId_campgroundId: { userId: owner.id, campgroundId: campground.id },
      },
      update: { role: "owner" },
      create: { userId: owner.id, campgroundId: campground.id, role: "owner" },
    });
    console.log("Created owner membership for campground:", campground.name);
  }

  await prisma.$disconnect();
}
run().catch(console.error);
