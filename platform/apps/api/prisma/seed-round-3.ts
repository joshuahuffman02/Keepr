import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaPg } from "@prisma/adapter-pg";

// Load env from root
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Round 3 Verification Data...");

  const campground = await prisma.campground.findFirst();
  if (!campground) throw new Error("No campground found");

  // 1. Ensure Campground has a slug
  const slug = campground.slug || "demo-camp";
  if (!campground.slug) {
    await prisma.campground.update({
      where: { id: campground.id },
      data: { slug: "demo-camp" },
    });
    console.log("Updated campground slug to demo-camp");
  }

  // 2. Create Promotion
  const promo = await prisma.promotion.upsert({
    where: { campgroundId_code: { campgroundId: campground.id, code: "SUMMER20" } },
    update: {},
    create: {
      campgroundId: campground.id,
      code: "SUMMER20",
      type: "percentage",
      value: 20,
      description: "Summer Sale 20% Off",
      isActive: true,
    },
  });
  console.log(`Created Promotion: ${promo.code}`);

  // 3. Create Message
  const reservation = await prisma.reservation.findFirst({
    where: { campgroundId: campground.id },
    include: { guest: true },
  });

  if (reservation) {
    await prisma.message.create({
      data: {
        campgroundId: campground.id,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        senderType: "guest",
        content: "Hello, what time is check-in?",
        createdAt: new Date(),
      },
    });
    console.log(`Created Message for Reservation: ${reservation.id}`);
  } else {
    console.log("No reservation found to attach message to.");
  }

  console.log("Seed Complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
