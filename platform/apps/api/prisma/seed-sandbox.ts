import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "sandbox-org" },
    update: {},
    create: {
      id: "sandbox-org",
      name: "Sandbox Org",
      subscriptionTier: "starter"
    }
  });

  const campground = await prisma.campground.upsert({
    where: { slug: "sandbox-park" },
    update: {},
    create: {
      id: "sandbox-camp",
      organizationId: org.id,
      name: "Sandbox Park",
      slug: "sandbox-park",
      city: "Demo",
      state: "CA",
      country: "USA",
      timezone: "America/Los_Angeles"
    }
  });

  const site = await prisma.site.upsert({
    where: { id: "sandbox-site-1" },
    update: {},
    create: {
      id: "sandbox-site-1",
      campgroundId: campground.id,
      siteNumber: "A1",
      name: "Pull-through A1",
      siteType: "rv",
      maxOccupancy: 8,
      rigMaxLength: 40
    }
  });

  const guest = await prisma.guest.upsert({
    where: { email: "sandbox-guest@campreserv.demo" },
    update: {},
    create: {
      id: "sandbox-guest",
      primaryFirstName: "Demo",
      primaryLastName: "Guest",
      email: "sandbox-guest@campreserv.demo",
      phone: "+15555550123"
    }
  });

  await prisma.reservation.upsert({
    where: { id: "sandbox-reservation" },
    update: {},
    create: {
      id: "sandbox-reservation",
      campgroundId: campground.id,
      siteId: site.id,
      guestId: guest.id,
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      adults: 2,
      children: 1,
      status: "confirmed",
      totalAmount: 20000,
      paidAmount: 5000,
      balanceAmount: 15000
    }
  });

  const clientSecret = randomBytes(12).toString("hex");
  const client = await prisma.apiClient.upsert({
    where: { clientId: "sandbox-client" },
    update: {
      campgroundId: campground.id,
      name: "Sandbox Demo Client",
      clientSecretHash: await bcrypt.hash(clientSecret, 12),
      scopes: ["reservations:read", "reservations:write", "guests:read", "guests:write", "sites:read", "sites:write", "webhooks:read", "webhooks:write"]
    },
    create: {
      campgroundId: campground.id,
      name: "Sandbox Demo Client",
      clientId: "sandbox-client",
      clientSecretHash: await bcrypt.hash(clientSecret, 12),
      scopes: ["reservations:read", "reservations:write", "guests:read", "guests:write", "sites:read", "sites:write", "webhooks:read", "webhooks:write"]
    }
  });

  console.log("Sandbox seeded");
  console.log(`Campground ID: ${campground.id}`);
  console.log(`API client_id: ${client.clientId}`);
  console.log(`API client_secret: ${clientSecret}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
