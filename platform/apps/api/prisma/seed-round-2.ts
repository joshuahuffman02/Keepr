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
  console.log("Seeding Round 2 Verification Data...");

  const campground = await prisma.campground.findFirst();
  if (!campground) throw new Error("No campground found");

  const siteClass = await prisma.siteClass.findFirst({ where: { campgroundId: campground.id } });
  if (!siteClass) throw new Error("No site class found");

  // 1. Create Sites for testing
  const site1 = await prisma.site.upsert({
    where: { campgroundId_name: { campgroundId: campground.id, name: "T100" } },
    update: {},
    create: {
      campgroundId: campground.id,
      siteClassId: siteClass.id,
      name: "T100",
      siteNumber: "T100",
      siteType: "rv",
      maxOccupancy: 4,
    },
  });

  const site2 = await prisma.site.upsert({
    where: { campgroundId_name: { campgroundId: campground.id, name: "T101" } },
    update: {},
    create: {
      campgroundId: campground.id,
      siteClassId: siteClass.id,
      name: "T101",
      siteNumber: "T101",
      siteType: "rv",
      maxOccupancy: 4,
    },
  });

  // 2. Create Guest
  const guest = await prisma.guest.upsert({
    where: { email: "test.guest@example.com" },
    update: {},
    create: {
      primaryFirstName: "Test",
      primaryLastName: "Guest",
      email: "test.guest@example.com",
      phone: "555-0000",
    },
  });

  // 3. Scenario A: Ready for Check-in (Confirmed, Arrival Today)
  const today = new Date();
  today.setHours(14, 0, 0, 0); // 2 PM today
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const resCheckIn = await prisma.reservation.create({
    data: {
      campgroundId: campground.id,
      siteId: site1.id,
      guestId: guest.id,
      arrivalDate: today,
      departureDate: tomorrow,
      status: "confirmed",
      adults: 2,
      totalAmount: 5000, // $50.00
      notes: "Scenario A: Ready for Check-in",
    },
  });
  console.log(`Created Reservation ready for Check-in: ${resCheckIn.id}`);

  // 4. Scenario B: Ready for Check-out (Checked In, Departure Today, Balance 0)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const resCheckOut = await prisma.reservation.create({
    data: {
      campgroundId: campground.id,
      siteId: site2.id,
      guestId: guest.id,
      arrivalDate: yesterday,
      departureDate: today,
      status: "checked_in",
      adults: 2,
      totalAmount: 5000,
      notes: "Scenario B: Ready for Check-out (Paid)",
    },
  });
  // Record payment to make balance 0
  await prisma.payment.create({
    data: {
      campgroundId: campground.id,
      reservationId: resCheckOut.id,
      amountCents: 5000,
      method: "card",
      direction: "charge",
      note: "seed-payment",
    },
  });
  console.log(`Created Reservation ready for Check-out: ${resCheckOut.id}`);

  // 5. Scenario C: Payment Needed (Confirmed, Balance Due)
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekEnd = new Date(nextWeek);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 2);

  const resPayment = await prisma.reservation.create({
    data: {
      campgroundId: campground.id,
      siteId: site1.id,
      guestId: guest.id,
      arrivalDate: nextWeek,
      departureDate: nextWeekEnd,
      status: "confirmed",
      adults: 2,
      totalAmount: 10000, // $100.00
      notes: "Scenario C: Payment Needed",
    },
  });
  console.log(`Created Reservation needing payment: ${resPayment.id}`);

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
