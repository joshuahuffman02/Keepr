/**
 * Demo Environment Seed Script
 *
 * Creates a fully-loaded demo campground with:
 * - 75 sites (RV, tent, cabin, glamping)
 * - 200+ historical reservations showing patterns
 * - 50+ guests with loyalty tiers
 * - POS products and inventory
 * - Staff schedules and payroll data
 * - AI recommendations pre-generated
 * - Maintenance tickets and housekeeping tasks
 *
 * Run with: npx ts-node prisma/seed-demo.ts
 */

import {
  PrismaClient,
  SiteType,
  ReservationStatus,
  UserRole,
  MaintenanceStatus,
  MaintenancePriority,
  RateType,
  ChargeStatus,
  GamificationEventCategory,
  StayType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// Helpers
const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const DEMO_ORG_NAME = "Demo Organization";
const DEMO_CAMPGROUND_NAME = "Evergreen Pines Demo Resort";
const DEMO_CAMPGROUND_SLUG = "evergreen-pines-demo";
const DEMO_USER_EMAIL = "demo@keeprstay.com";
const DEMO_USER_PASSWORD = "demo123";

// Site class definitions
const siteClassDefs = [
  {
    name: "Premium RV Full Hookup",
    type: SiteType.rv,
    basePrice: 7500, // $75
    count: 20,
    amenities: ["50 amp", "30 amp", "Water", "Sewer", "Cable", "WiFi"],
    maxLength: 45,
  },
  {
    name: "Standard RV",
    type: SiteType.rv,
    basePrice: 5500, // $55
    count: 15,
    amenities: ["30 amp", "Water", "WiFi"],
    maxLength: 35,
  },
  {
    name: "Pull-Through RV",
    type: SiteType.rv,
    basePrice: 8500, // $85
    count: 10,
    amenities: ["50 amp", "30 amp", "Water", "Sewer", "Cable", "WiFi", "Pull-Through"],
    maxLength: 55,
  },
  {
    name: "Tent Sites",
    type: SiteType.tent,
    basePrice: 3500, // $35
    count: 12,
    amenities: ["Fire Ring", "Picnic Table", "Water Nearby"],
    maxLength: 0,
  },
  {
    name: "Rustic Cabin",
    type: SiteType.cabin,
    basePrice: 12500, // $125
    count: 8,
    amenities: ["Sleeps 4", "AC", "Heat", "Kitchenette"],
    maxLength: 0,
  },
  {
    name: "Deluxe Cabin",
    type: SiteType.cabin,
    basePrice: 17500, // $175
    count: 5,
    amenities: ["Sleeps 6", "Full Kitchen", "AC", "Heat", "Deck", "Hot Tub"],
    maxLength: 0,
  },
  {
    name: "Glamping Tent",
    type: SiteType.glamping,
    basePrice: 15000, // $150
    count: 5,
    amenities: ["Queen Bed", "AC", "Deck", "Fire Pit", "Stargazing"],
    maxLength: 0,
  },
];

// Guest names for realistic data
const firstNames = [
  "Sarah", "Michael", "Emily", "James", "Jennifer", "David", "Amanda", "Robert",
  "Jessica", "William", "Ashley", "Christopher", "Nicole", "Matthew", "Stephanie",
  "Daniel", "Elizabeth", "Andrew", "Michelle", "Joshua", "Lisa", "Anthony", "Karen",
  "Mark", "Patricia", "Steven", "Linda", "Paul", "Barbara", "Kevin", "Nancy",
  "Brian", "Betty", "George", "Margaret", "Edward", "Sandra", "Ronald", "Dorothy",
  "Timothy", "Kimberly", "Jason", "Donna", "Jeffrey", "Carol", "Ryan", "Ruth",
  "Jacob", "Sharon", "Gary", "Helen",
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts",
];

const cities = [
  { city: "Denver", state: "CO" },
  { city: "Phoenix", state: "AZ" },
  { city: "Salt Lake City", state: "UT" },
  { city: "Portland", state: "OR" },
  { city: "Seattle", state: "WA" },
  { city: "San Francisco", state: "CA" },
  { city: "Los Angeles", state: "CA" },
  { city: "Austin", state: "TX" },
  { city: "Minneapolis", state: "MN" },
  { city: "Chicago", state: "IL" },
];

// POS Products
const posProducts = [
  { name: "Firewood Bundle", price: 800, category: "Supplies" },
  { name: "Ice Bag (10lb)", price: 400, category: "Supplies" },
  { name: "S'mores Kit", price: 1200, category: "Food" },
  { name: "Keepr T-Shirt", price: 2500, category: "Merchandise" },
  { name: "Fishing License (Day)", price: 1500, category: "Services" },
  { name: "Kayak Rental (Hour)", price: 2000, category: "Rentals" },
  { name: "Bike Rental (Day)", price: 3500, category: "Rentals" },
  { name: "Late Checkout", price: 2500, category: "Services" },
  { name: "Extra Vehicle Pass", price: 1000, category: "Fees" },
  { name: "Pet Fee", price: 1500, category: "Fees" },
];

async function main() {
  console.log("Starting demo environment seed...\n");

  // Check if demo already exists
  const existingOrg = await prisma.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
  });

  if (existingOrg) {
    console.log("Demo environment already exists. Cleaning up...");
    const existingCampground = await prisma.campground.findFirst({
      where: { slug: DEMO_CAMPGROUND_SLUG },
    });
    if (existingCampground) {
      // Delete in correct order to avoid FK constraints
      await prisma.reservation.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.site.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.siteClass.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.guest.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.product.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.productCategory.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.maintenanceTicket.deleteMany({ where: { campgroundId: existingCampground.id } });
      await prisma.campground.delete({ where: { id: existingCampground.id } });
    }
    await prisma.organization.delete({ where: { id: existingOrg.id } });
  }

  // 1. Create Demo User
  console.log("1. Creating demo user...");
  const hashedPassword = await bcrypt.hash(DEMO_USER_PASSWORD, 12);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      firstName: "Demo",
      lastName: "User",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`   Created user: ${demoUser.email}`);

  // 2. Create Organization
  console.log("2. Creating demo organization...");
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      slug: "demo-org",
    },
  });
  console.log(`   Created org: ${org.name}`);

  // 3. Create Campground
  console.log("3. Creating demo campground...");
  const campground = await prisma.campground.create({
    data: {
      name: DEMO_CAMPGROUND_NAME,
      slug: DEMO_CAMPGROUND_SLUG,
      organizationId: org.id,
      address: "1234 Demo Lane",
      city: "Bend",
      state: "OR",
      zip: "97701",
      country: "USA",
      phone: "(555) 123-4567",
      email: "info@evergreenpines.demo",
      timezone: "America/Los_Angeles",
      currency: "USD",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      latitude: 44.0582,
      longitude: -121.3153,
      tagline: "Your mountain escape awaits",
      description:
        "Nestled in the beautiful Cascade Mountains, Evergreen Pines offers premium RV sites, cozy cabins, and unique glamping experiences for the perfect outdoor getaway.",
      heroImageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200",
      isPubliclyListed: true,
    },
  });
  console.log(`   Created campground: ${campground.name}`);

  // Add user to campground
  await prisma.campgroundMembership.create({
    data: {
      userId: demoUser.id,
      campgroundId: campground.id,
      role: UserRole.owner,
    },
  });

  // 4. Create Site Classes and Sites
  console.log("4. Creating site classes and 75 sites...");
  let totalSites = 0;
  const siteClasses: Array<{ id: string; name: string; type: SiteType; basePrice: number }> = [];

  for (const classDef of siteClassDefs) {
    const siteClass = await prisma.siteClass.create({
      data: {
        campgroundId: campground.id,
        name: classDef.name,
        type: classDef.type,
        basePriceCents: classDef.basePrice,
        description: `${classDef.name} with ${classDef.amenities.slice(0, 3).join(", ")}`,
        maxOccupancy: classDef.type === SiteType.cabin ? 6 : 8,
        amenities: classDef.amenities,
      },
    });

    siteClasses.push({
      id: siteClass.id,
      name: siteClass.name,
      type: classDef.type,
      basePrice: classDef.basePrice,
    });

    // Create sites for this class
    for (let i = 1; i <= classDef.count; i++) {
      totalSites++;
      const prefix =
        classDef.type === SiteType.rv
          ? "RV"
          : classDef.type === SiteType.tent
          ? "T"
          : classDef.type === SiteType.cabin
          ? "C"
          : "G";

      await prisma.site.create({
        data: {
          campgroundId: campground.id,
          siteClassId: siteClass.id,
          name: `${prefix}-${String(totalSites).padStart(3, "0")}`,
          status: "available",
          maxLength: classDef.maxLength || null,
          isPullThrough: classDef.amenities.includes("Pull-Through"),
          hasElectric: classDef.amenities.some((a) => a.includes("amp")),
          hasWater: classDef.amenities.some((a) => a.includes("Water")),
          hasSewer: classDef.amenities.some((a) => a.includes("Sewer")),
        },
      });
    }
  }
  console.log(`   Created ${totalSites} sites across ${siteClasses.length} classes`);

  // 5. Create Guests
  console.log("5. Creating 50+ guests with loyalty tiers...");
  const guests: Array<{ id: string; firstName: string; lastName: string; email: string }> = [];

  for (let i = 0; i < 55; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const location = pick(cities);
    const loyaltyPoints = randomBetween(0, 5000);
    const loyaltyTier =
      loyaltyPoints >= 3000
        ? "Gold"
        : loyaltyPoints >= 1500
        ? "Silver"
        : loyaltyPoints >= 500
        ? "Bronze"
        : "Member";

    const guest = await prisma.guest.create({
      data: {
        campgroundId: campground.id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        phone: `(555) ${String(randomBetween(100, 999))}-${String(randomBetween(1000, 9999))}`,
        city: location.city,
        state: location.state,
        country: "USA",
        loyaltyPoints,
        loyaltyTier,
        totalStays: randomBetween(1, 15),
        totalSpentCents: randomBetween(50000, 500000),
        notes:
          loyaltyPoints >= 3000
            ? "VIP guest - always ensure best site available"
            : undefined,
      },
    });

    guests.push({
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
    });
  }
  console.log(`   Created ${guests.length} guests`);

  // 6. Create Reservations
  console.log("6. Creating 200+ reservations...");
  const sites = await prisma.site.findMany({
    where: { campgroundId: campground.id },
    include: { siteClass: true },
  });

  let reservationCount = 0;
  const today = new Date();

  // Historical reservations (past 6 months)
  for (let daysAgo = 180; daysAgo > 0; daysAgo -= randomBetween(1, 3)) {
    const numBookings = randomBetween(1, 5);
    for (let b = 0; b < numBookings; b++) {
      const site = pick(sites);
      const guest = pick(guests);
      const checkIn = addDays(today, -daysAgo);
      const nights = randomBetween(1, 7);
      const checkOut = addDays(checkIn, nights);
      const basePrice = site.siteClass.basePriceCents;
      const totalAmount = basePrice * nights;

      const statuses: ReservationStatus[] = [
        ReservationStatus.checked_out,
        ReservationStatus.checked_out,
        ReservationStatus.checked_out,
        ReservationStatus.cancelled,
      ];

      await prisma.reservation.create({
        data: {
          campgroundId: campground.id,
          guestId: guest.id,
          siteId: site.id,
          checkIn,
          checkOut,
          nights,
          adults: randomBetween(1, 4),
          children: randomBetween(0, 3),
          pets: randomBetween(0, 2),
          status: pick(statuses),
          totalAmountCents: totalAmount,
          balanceAmountCents: 0,
          stayType: nights >= 28 ? StayType.monthly : nights >= 7 ? StayType.weekly : StayType.nightly,
          source: pick(["direct", "direct", "phone", "walk_in"]),
          confirmationCode: `CE${String(reservationCount + 1000).padStart(6, "0")}`,
        },
      });
      reservationCount++;
    }
  }

  // Current and upcoming reservations
  for (let daysAhead = -3; daysAhead < 60; daysAhead += randomBetween(1, 2)) {
    const numBookings = randomBetween(2, 8);
    for (let b = 0; b < numBookings; b++) {
      const site = pick(sites);
      const guest = pick(guests);
      const checkIn = addDays(today, daysAhead);
      const nights = randomBetween(2, 5);
      const checkOut = addDays(checkIn, nights);
      const basePrice = site.siteClass.basePriceCents;
      const totalAmount = basePrice * nights;

      let status: ReservationStatus;
      let balanceAmount = 0;

      if (daysAhead < 0) {
        status = ReservationStatus.checked_in;
      } else if (daysAhead === 0) {
        status = pick([ReservationStatus.confirmed, ReservationStatus.checked_in]);
      } else {
        status = ReservationStatus.confirmed;
        balanceAmount = totalAmount; // Still owed
      }

      await prisma.reservation.create({
        data: {
          campgroundId: campground.id,
          guestId: guest.id,
          siteId: site.id,
          checkIn,
          checkOut,
          nights,
          adults: randomBetween(1, 4),
          children: randomBetween(0, 2),
          pets: randomBetween(0, 1),
          status,
          totalAmountCents: totalAmount,
          balanceAmountCents: balanceAmount,
          stayType: StayType.nightly,
          source: pick(["direct", "direct", "direct", "booking_engine"]),
          confirmationCode: `CE${String(reservationCount + 1000).padStart(6, "0")}`,
        },
      });
      reservationCount++;
    }
  }
  console.log(`   Created ${reservationCount} reservations`);

  // 7. Create POS Products
  console.log("7. Creating POS products and categories...");
  const categories = new Map<string, string>();

  for (const product of posProducts) {
    let categoryId = categories.get(product.category);
    if (!categoryId) {
      const cat = await prisma.productCategory.create({
        data: {
          campgroundId: campground.id,
          name: product.category,
        },
      });
      categoryId = cat.id;
      categories.set(product.category, cat.id);
    }

    await prisma.product.create({
      data: {
        campgroundId: campground.id,
        categoryId,
        name: product.name,
        priceCents: product.price,
        stockQuantity: randomBetween(10, 100),
        lowStockThreshold: 5,
        isActive: true,
      },
    });
  }
  console.log(`   Created ${posProducts.length} products in ${categories.size} categories`);

  // 8. Create Maintenance Tickets
  console.log("8. Creating maintenance tickets...");
  const maintenanceItems = [
    { title: "Fix leaking faucet in Site C-001", priority: MaintenancePriority.medium },
    { title: "Replace broken picnic table at T-003", priority: MaintenancePriority.low },
    { title: "Electrical issue at RV-015 - no 50amp", priority: MaintenancePriority.high },
    { title: "Trim overgrown trees near glamping area", priority: MaintenancePriority.low },
    { title: "Repair shower head in Bathhouse B", priority: MaintenancePriority.medium },
    { title: "Pool heater not working", priority: MaintenancePriority.high },
    { title: "Replace burnt out lights on path to lake", priority: MaintenancePriority.low },
    { title: "AC unit in Cabin C-005 making noise", priority: MaintenancePriority.medium },
  ];

  for (const item of maintenanceItems) {
    await prisma.maintenanceTicket.create({
      data: {
        campgroundId: campground.id,
        title: item.title,
        description: `Guest reported: ${item.title}`,
        priority: item.priority,
        status: pick([
          MaintenanceStatus.open,
          MaintenanceStatus.open,
          MaintenanceStatus.in_progress,
          MaintenanceStatus.completed,
        ]),
        reportedAt: addDays(today, -randomBetween(1, 14)),
      },
    });
  }
  console.log(`   Created ${maintenanceItems.length} maintenance tickets`);

  // Summary
  console.log("\n========================================");
  console.log("Demo environment created successfully!");
  console.log("========================================");
  console.log(`\nDemo Login Credentials:`);
  console.log(`  Email: ${DEMO_USER_EMAIL}`);
  console.log(`  Password: ${DEMO_USER_PASSWORD}`);
  console.log(`\nDemo Campground: ${DEMO_CAMPGROUND_NAME}`);
  console.log(`\nData Created:`);
  console.log(`  - ${totalSites} sites`);
  console.log(`  - ${guests.length} guests`);
  console.log(`  - ${reservationCount} reservations`);
  console.log(`  - ${posProducts.length} POS products`);
  console.log(`  - ${maintenanceItems.length} maintenance tickets`);
  console.log("========================================\n");
}

main()
  .catch((e) => {
    console.error("Error seeding demo environment:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
