/**
 * Comprehensive seed for Keepr - Riverbend
 * Creates full demo data for testing all features
 *
 * Run: DATABASE_URL="..." npx tsx prisma/seed-riverbend-full.ts
 */

import {
  PrismaClient,
  ReservationStatus,
  SiteType,
  MaintenanceStatus,
  MaintenancePriority,
  StayType,
  ChargeStatus,
  SeasonalStatus,
  RenewalIntent,
  SeasonalPaymentMethod,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// Helpers
const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

// GL Codes
const GL_CODES = {
  SITE_REVENUE: "4100",
  FEES_REVENUE: "4200",
  TAX_PAYABLE: "2100",
  CASH: "1000",
};

// Names for generating guests
const firstNames = [
  "James",
  "Mary",
  "Robert",
  "Patricia",
  "John",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Elizabeth",
  "William",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Christopher",
  "Karen",
  "Charles",
  "Lisa",
  "Daniel",
  "Nancy",
  "Matthew",
  "Betty",
  "Anthony",
  "Margaret",
  "Mark",
  "Sandra",
  "Donald",
  "Ashley",
  "Steven",
  "Dorothy",
  "Paul",
  "Kimberly",
  "Andrew",
  "Emily",
  "Joshua",
  "Donna",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
];

async function main() {
  console.log("=== Seeding Keepr - Riverbend ===\n");

  // Find the campground
  const campground = await prisma.campground.findFirst({
    where: { slug: "keepr-riverbend" },
  });

  if (!campground) {
    console.error("Keepr - Riverbend not found!");
    process.exit(1);
  }

  console.log(`Found campground: ${campground.name} (${campground.id})\n`);

  // Get existing data
  const sites = await prisma.site.findMany({
    where: { campgroundId: campground.id },
    select: { id: true, name: true, siteClassId: true, siteType: true },
  });
  console.log(`Found ${sites.length} sites`);

  const siteClasses = await prisma.siteClass.findMany({
    where: { campgroundId: campground.id },
    select: { id: true, name: true, defaultRate: true },
  });
  console.log(`Found ${siteClasses.length} site classes`);

  const seasonalRates = await prisma.seasonalRate.findMany({
    where: { campgroundId: campground.id },
    select: { id: true, name: true, siteClassId: true },
  });
  console.log(`Found ${seasonalRates.length} seasonal rates`);

  // ============ CREATE GUESTS ============
  console.log("\n--- Creating Guests ---");
  const guests = [];
  for (let i = 0; i < 200; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const emailNormalized = email.toLowerCase().trim();

    const guest = await prisma.guest.upsert({
      where: { emailNormalized },
      update: {},
      create: {
        primaryFirstName: firstName,
        primaryLastName: lastName,
        email,
        emailNormalized,
        phone: `555-${String(randomBetween(100, 999))}-${String(randomBetween(1000, 9999))}`,
        address1: `${randomBetween(100, 9999)} ${pick(["Oak", "Maple", "Pine", "Cedar", "Elm"])} ${pick(["St", "Ave", "Rd", "Dr", "Ln"])}`,
        city: pick([
          "Minneapolis",
          "St. Paul",
          "Rochester",
          "Duluth",
          "Madison",
          "Milwaukee",
          "Chicago",
        ]),
        state: pick(["MN", "WI", "IA", "IL"]),
        postalCode: String(randomBetween(50000, 60000)),
        notes: i % 10 === 0 ? "VIP guest - always give best site" : null,
        tags: i % 15 === 0 ? ["vip"] : i % 8 === 0 ? ["seasonal"] : [],
        vip: i % 15 === 0,
      },
    });
    guests.push(guest);
    if (i % 50 === 0) console.log(`  Created ${i} guests...`);
  }
  console.log(`Created/found ${guests.length} guests`);

  // ============ CREATE SEASONAL GUESTS ============
  console.log("\n--- Creating 30 Seasonal Guests ---");
  const seasonalGuests = [];
  const rvSites = sites.filter((s) => s.siteType === SiteType.rv);

  for (let i = 0; i < 30; i++) {
    const guest = guests[i];
    const site = rvSites[i % rvSites.length];

    const seasonal = await prisma.seasonalGuest.upsert({
      where: {
        guestId_campgroundId: { guestId: guest.id, campgroundId: campground.id },
      },
      update: {},
      create: {
        campgroundId: campground.id,
        guestId: guest.id,
        firstSeasonYear: randomBetween(2019, 2024),
        totalSeasons: randomBetween(1, 6),
        seniorityRank: i + 1,
        currentSiteId: site?.id,
        preferredSites: site ? [site.id] : [],
        status:
          i < 25
            ? SeasonalStatus.active
            : pick([SeasonalStatus.pending_renewal, SeasonalStatus.churned]),
        renewalIntent:
          i < 20
            ? RenewalIntent.returning
            : i < 25
              ? RenewalIntent.undecided
              : RenewalIntent.leaving,
        renewalNotes: i >= 25 ? "Moving out of state" : null,
        preferredPaymentMethod: pick([
          SeasonalPaymentMethod.ach,
          SeasonalPaymentMethod.card,
          SeasonalPaymentMethod.check,
        ]),
        paysInFull: i % 4 === 0,
        autoPayEnabled: i % 3 === 0,
        paymentDay: pick([1, 5, 15]),
        isMetered: i % 2 === 0,
        meteredElectric: i % 2 === 0,
        meteredWater: i % 4 === 0,
        coiExpiresAt: addDays(new Date(), randomBetween(30, 365)),
        vehiclePlates: [
          `${pick(["MN", "WI", "IA"])}-${randomBetween(100, 999)}-${String.fromCharCode(65 + randomBetween(0, 25))}${String.fromCharCode(65 + randomBetween(0, 25))}${String.fromCharCode(65 + randomBetween(0, 25))}`,
        ],
        petCount: randomBetween(0, 2),
        petNotes: i % 3 === 0 ? "2 dogs - friendly" : null,
        emergencyContact: `${pick(firstNames)} ${pick(lastNames)}`,
        emergencyPhone: `555-${randomBetween(100, 999)}-${randomBetween(1000, 9999)}`,
        notes: i % 5 === 0 ? "Long-time seasonal, very helpful around the park" : null,
        tags: i < 5 ? ["founding-member"] : i < 10 ? ["vip"] : [],
      },
    });
    seasonalGuests.push(seasonal);
  }
  console.log(`Created ${seasonalGuests.length} seasonal guests`);

  // ============ CREATE SEASONAL RATE CARDS & PRICING ============
  console.log("\n--- Creating Seasonal Rate Cards & Pricing ---");

  // Create rate card for 2025
  const rateCard2025 = await prisma.seasonalRateCard.upsert({
    where: { id: "seed-rate-card-2025-riverbend" },
    update: {},
    create: {
      id: "seed-rate-card-2025-riverbend",
      campgroundId: campground.id,
      name: "2025 Season - Standard",
      seasonYear: 2025,
      baseRate: 3200,
      billingFrequency: "monthly",
      description: "May-October 2025. Includes water, sewer, WiFi.",
      includedUtilities: ["water", "sewer", "wifi"],
      seasonStartDate: new Date("2025-05-01"),
      seasonEndDate: new Date("2025-10-31"),
      isActive: true,
      isDefault: true,
    },
  });

  // Create rate card for 2026
  const rateCard2026 = await prisma.seasonalRateCard.upsert({
    where: { id: "seed-rate-card-2026-riverbend" },
    update: {},
    create: {
      id: "seed-rate-card-2026-riverbend",
      campgroundId: campground.id,
      name: "2026 Season - Standard",
      seasonYear: 2026,
      baseRate: 3400,
      billingFrequency: "monthly",
      description: "May-October 2026. Includes water, sewer, WiFi.",
      includedUtilities: ["water", "sewer", "wifi"],
      seasonStartDate: new Date("2026-05-01"),
      seasonEndDate: new Date("2026-10-31"),
      isActive: true,
      isDefault: false,
    },
  });

  // Create pricing records for each seasonal guest (2025)
  for (const sg of seasonalGuests) {
    const baseRate = 3200 + randomBetween(-200, 400); // Some variation
    const discount = sg.tags?.includes("founding-member")
      ? 200
      : sg.tags?.includes("vip")
        ? 100
        : 0;

    await prisma.seasonalGuestPricing.upsert({
      where: {
        seasonalGuestId_seasonYear: { seasonalGuestId: sg.id, seasonYear: 2025 },
      },
      update: {},
      create: {
        seasonalGuestId: sg.id,
        rateCardId: rateCard2025.id,
        seasonYear: 2025,
        baseRate,
        totalDiscount: discount,
        finalRate: baseRate - discount,
        billingFrequency: "monthly",
        appliedDiscounts:
          discount > 0
            ? JSON.stringify([
                {
                  name: sg.tags?.includes("founding-member") ? "Founding Member" : "VIP",
                  amount: discount,
                },
              ])
            : "[]",
        paymentSchedule: JSON.stringify([
          { dueDate: "2025-05-01", amount: (baseRate - discount) / 6, description: "May payment" },
          { dueDate: "2025-06-01", amount: (baseRate - discount) / 6, description: "June payment" },
          { dueDate: "2025-07-01", amount: (baseRate - discount) / 6, description: "July payment" },
          {
            dueDate: "2025-08-01",
            amount: (baseRate - discount) / 6,
            description: "August payment",
          },
          {
            dueDate: "2025-09-01",
            amount: (baseRate - discount) / 6,
            description: "September payment",
          },
          {
            dueDate: "2025-10-01",
            amount: (baseRate - discount) / 6,
            description: "October payment",
          },
        ]),
      },
    });
  }
  console.log(`Created rate cards and ${seasonalGuests.length} pricing records for 2025`);

  // ============ CREATE RESERVATIONS ============
  console.log("\n--- Creating 500 Reservations ---");
  const siteBookings = new Map<string, { start: Date; end: Date }[]>();
  let reservationCount = 0;
  let paymentCount = 0;

  for (let i = 0; i < 500; i++) {
    // Determine year and stay type
    const year = pick([2023, 2024, 2024, 2025, 2025, 2025, 2026]);
    const stayType = pick([
      StayType.standard,
      StayType.standard,
      StayType.standard,
      StayType.weekly,
      StayType.monthly,
      StayType.seasonal,
    ]);
    const isFuture = year >= 2025;

    // Find available site
    let site: (typeof sites)[0] | undefined;
    let arrivalDate: Date;
    let departureDate: Date;
    let nights: number;

    for (let attempt = 0; attempt < 30; attempt++) {
      const candidateSite = pick(sites);

      // Generate dates based on stay type
      const seasonStart = new Date(Date.UTC(year, 3, 15)); // April 15
      const seasonEnd = new Date(Date.UTC(year, 9, 31)); // October 31

      if (stayType === StayType.seasonal) {
        nights = randomBetween(120, 200);
      } else if (stayType === StayType.monthly) {
        nights = randomBetween(28, 45);
      } else if (stayType === StayType.weekly) {
        nights = randomBetween(7, 14);
      } else {
        nights = randomBetween(2, 7);
      }

      const maxStart = new Date(seasonEnd.getTime() - nights * 24 * 60 * 60 * 1000);
      const startOffset = randomBetween(
        0,
        Math.max(
          1,
          Math.floor((maxStart.getTime() - seasonStart.getTime()) / (24 * 60 * 60 * 1000)),
        ),
      );
      arrivalDate = addDays(seasonStart, startOffset);
      departureDate = addDays(arrivalDate, nights);

      // Check for overlaps
      const bookings = siteBookings.get(candidateSite.id) || [];
      const hasOverlap = bookings.some((b) => arrivalDate < b.end && departureDate > b.start);

      if (!hasOverlap) {
        site = candidateSite;
        siteBookings.set(candidateSite.id, [
          ...bookings,
          { start: arrivalDate, end: departureDate },
        ]);
        break;
      }
    }

    if (!site) continue;

    const guest = pick(guests);
    const siteClass = siteClasses.find((c) => c.id === site!.siteClassId) || siteClasses[0];
    const baseRate = siteClass?.defaultRate ?? 7500;

    // Calculate amounts
    const rateMultiplier =
      stayType === StayType.seasonal
        ? 0.85
        : stayType === StayType.monthly
          ? 0.9
          : stayType === StayType.weekly
            ? 0.95
            : 1;
    const baseSubtotal = Math.round(baseRate * nights * rateMultiplier);
    const feesAmount = randomBetween(500, 3500);
    const taxesAmount = Math.round((baseSubtotal + feesAmount) * 0.0835);
    const discountsAmount =
      stayType !== StayType.standard && randomBetween(0, 2) === 0 ? randomBetween(1000, 5000) : 0;
    const totalAmount = Math.max(0, baseSubtotal + feesAmount + taxesAmount - discountsAmount);

    // Payment status
    let paidAmount: number;
    if (isFuture) {
      paidAmount = pick([
        0,
        Math.round(totalAmount * 0.25),
        Math.round(totalAmount * 0.5),
        totalAmount,
      ]);
    } else {
      paidAmount = pick([totalAmount, totalAmount, totalAmount, Math.round(totalAmount * 0.5), 0]);
    }
    const paymentStatus =
      paidAmount === 0 ? "unpaid" : paidAmount >= totalAmount ? "paid" : "partial";

    // Reservation status
    const now = new Date();
    let status: ReservationStatus;
    if (departureDate < now) {
      status = pick([
        ReservationStatus.checked_out,
        ReservationStatus.checked_out,
        ReservationStatus.checked_out,
        ReservationStatus.cancelled,
      ]);
    } else if (arrivalDate < now && departureDate > now) {
      status = ReservationStatus.checked_in;
    } else {
      status = pick([
        ReservationStatus.confirmed,
        ReservationStatus.confirmed,
        ReservationStatus.pending,
        ReservationStatus.cancelled,
      ]);
    }

    const seasonalRateId =
      stayType === StayType.seasonal || stayType === StayType.monthly
        ? seasonalRates.find((r) => !r.siteClassId || r.siteClassId === site!.siteClassId)?.id
        : null;

    const bookedAt = addDays(arrivalDate!, -randomBetween(7, 120));

    const reservation = await prisma.reservation.create({
      data: {
        campgroundId: campground.id,
        siteId: site.id,
        guestId: guest.id,
        arrivalDate: arrivalDate!,
        departureDate: departureDate!,
        adults: randomBetween(1, 4),
        children: randomBetween(0, 3),
        status,
        totalAmount,
        paidAmount,
        balanceAmount: Math.max(0, totalAmount - paidAmount),
        paymentStatus,
        baseSubtotal,
        feesAmount,
        taxesAmount,
        discountsAmount,
        promoCode: discountsAmount > 0 ? pick(["SUMMER20", "SEASONAL10", "EARLYBIRD"]) : null,
        source: pick(["phone", "web", "web", "web", "ota", "walk-in"]),
        checkInWindowStart: "14:00",
        checkInWindowEnd: "21:00",
        vehiclePlate: `${pick(["ABC", "XYZ", "MN", "WI"])}-${randomBetween(1000, 9999)}`,
        vehicleState: pick(["MN", "WI", "IA", "IL", "ND", "SD"]),
        rigType:
          site.siteType === SiteType.rv
            ? pick(["Class A", "Class C", "Fifth Wheel", "Travel Trailer", "Pop-up"])
            : null,
        rigLength: site.siteType === SiteType.rv ? randomBetween(20, 45) : null,
        depositAmount: Math.round(baseRate),
        stayType,
        seasonalRateId,
        bookedAt,
        notes: i % 20 === 0 ? "Guest requested late checkout" : null,
      },
    });
    reservationCount++;

    // Create payment if paid
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          campgroundId: campground.id,
          reservationId: reservation.id,
          amountCents: paidAmount,
          method: pick(["card", "card", "card", "cash", "check", "ach"]),
          direction: "charge",
          note: paidAmount === totalAmount ? "Full payment" : "Deposit",
          createdAt: addDays(arrivalDate!, -randomBetween(1, 30)),
        },
      });
      paymentCount++;

      // Ledger entries
      await prisma.ledgerEntry.createMany({
        data: [
          {
            campgroundId: campground.id,
            reservationId: reservation.id,
            glCode: GL_CODES.CASH,
            account: "Cash",
            description: `Payment - ${guest.primaryFirstName} ${guest.primaryLastName}`,
            amountCents: paidAmount,
            direction: "debit",
            occurredAt: addDays(arrivalDate!, -randomBetween(1, 30)),
          },
          {
            campgroundId: campground.id,
            reservationId: reservation.id,
            glCode: GL_CODES.SITE_REVENUE,
            account: "Site Revenue",
            description: `Site rental - ${site.name}`,
            amountCents: baseSubtotal,
            direction: "credit",
            occurredAt: addDays(arrivalDate!, -randomBetween(1, 30)),
          },
        ],
      });
    }

    // Repeat charges for long stays
    if (stayType === StayType.monthly || stayType === StayType.seasonal) {
      const installments = stayType === StayType.seasonal ? 4 : 2;
      for (let j = 0; j < installments; j++) {
        await prisma.repeatCharge.create({
          data: {
            reservationId: reservation.id,
            amount: Math.round(totalAmount / installments),
            dueDate: addDays(arrivalDate!, (j + 1) * 30),
            status:
              j === 0
                ? ChargeStatus.paid
                : pick([ChargeStatus.pending, ChargeStatus.pending, ChargeStatus.failed]),
            paidAt: j === 0 ? addDays(arrivalDate!, 2) : null,
          },
        });
      }
    }

    if (i % 50 === 0) console.log(`  Created ${i} reservations...`);
  }
  console.log(`Created ${reservationCount} reservations with ${paymentCount} payments`);

  // ============ MAINTENANCE TICKETS ============
  console.log("\n--- Creating Maintenance Tickets ---");
  const ticketData = [
    {
      title: "Water heater not working in bathhouse",
      priority: MaintenancePriority.high,
      status: MaintenanceStatus.in_progress,
    },
    {
      title: "Broken picnic table at site P-12",
      priority: MaintenancePriority.medium,
      status: MaintenanceStatus.open,
    },
    {
      title: "Electrical outlet sparking at site R-05",
      priority: MaintenancePriority.critical,
      status: MaintenanceStatus.in_progress,
    },
    {
      title: "Tree branch over site T-03",
      priority: MaintenancePriority.low,
      status: MaintenanceStatus.open,
    },
    {
      title: "Pothole in main road near entrance",
      priority: MaintenancePriority.medium,
      status: MaintenanceStatus.open,
    },
    {
      title: "Playground swing chain needs replacement",
      priority: MaintenancePriority.low,
      status: MaintenanceStatus.completed,
    },
    {
      title: "WiFi router down in lodge",
      priority: MaintenancePriority.high,
      status: MaintenanceStatus.completed,
    },
    {
      title: "Sewer hookup leak at site P-08",
      priority: MaintenancePriority.critical,
      status: MaintenanceStatus.open,
    },
    {
      title: "Light bulb out in restroom A",
      priority: MaintenancePriority.low,
      status: MaintenanceStatus.completed,
    },
    {
      title: "Fire pit needs cleaning - site T-07",
      priority: MaintenancePriority.low,
      status: MaintenanceStatus.open,
    },
    {
      title: "Ice machine not making ice",
      priority: MaintenancePriority.medium,
      status: MaintenanceStatus.in_progress,
    },
    {
      title: "Gate arm stuck open",
      priority: MaintenancePriority.high,
      status: MaintenanceStatus.open,
    },
    {
      title: "Pool filter needs backwash",
      priority: MaintenancePriority.medium,
      status: MaintenanceStatus.completed,
    },
    {
      title: "Laundry dryer #3 not heating",
      priority: MaintenancePriority.medium,
      status: MaintenanceStatus.open,
    },
    {
      title: "Graffiti on dumpster enclosure",
      priority: MaintenancePriority.low,
      status: MaintenanceStatus.open,
    },
  ];

  for (const ticket of ticketData) {
    await prisma.maintenanceTicket.create({
      data: {
        campgroundId: campground.id,
        siteId: sites[randomBetween(0, sites.length - 1)].id,
        title: ticket.title,
        description: `${ticket.title}. Reported by guest.`,
        priority: ticket.priority,
        status: ticket.status,
        notes: `Reported by: ${pick(["Guest", "Staff", "Inspection"])}`,
        createdAt: addDays(new Date(), -randomBetween(0, 30)),
      },
    });
  }
  console.log(`Created ${ticketData.length} maintenance tickets`);

  // ============ PRODUCTS (POS) ============
  console.log("\n--- Creating Products ---");
  const products = [
    { name: "Firewood Bundle", sku: "FIRE-001", price: 800, category: "Supplies" },
    { name: "Ice Bag (10lb)", sku: "ICE-001", price: 400, category: "Supplies" },
    { name: "S'mores Kit", sku: "FOOD-001", price: 1200, category: "Food" },
    { name: "Keepr T-Shirt", sku: "MERCH-001", price: 2500, category: "Merchandise" },
    { name: "Keepr Hat", sku: "MERCH-002", price: 1800, category: "Merchandise" },
    { name: "Propane Refill", sku: "PROP-001", price: 2200, category: "Supplies" },
    { name: "RV Sewer Kit", sku: "RV-001", price: 3500, category: "RV Supplies" },
    { name: "30A Extension Cord", sku: "RV-002", price: 4500, category: "RV Supplies" },
    { name: "Bug Spray", sku: "CAMP-001", price: 900, category: "Supplies" },
    { name: "Sunscreen SPF50", sku: "CAMP-002", price: 1100, category: "Supplies" },
    { name: "Hot Dog (single)", sku: "FOOD-002", price: 350, category: "Food" },
    { name: "Soda Can", sku: "FOOD-003", price: 200, category: "Food" },
    { name: "Coffee (large)", sku: "FOOD-004", price: 300, category: "Food" },
    { name: "Kayak Rental (day)", sku: "RENT-001", price: 5000, category: "Rentals" },
    { name: "Bike Rental (day)", sku: "RENT-002", price: 3000, category: "Rentals" },
  ];

  // Get or create category
  let category = await prisma.productCategory.findFirst({
    where: { campgroundId: campground.id, name: "General" },
  });
  if (!category) {
    category = await prisma.productCategory.create({
      data: { campgroundId: campground.id, name: "General", sortOrder: 1 },
    });
  }

  for (const prod of products) {
    // Check if product exists first
    const existing = await prisma.product.findFirst({
      where: { campgroundId: campground.id, sku: prod.sku },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          campgroundId: campground.id,
          categoryId: category.id,
          name: prod.name,
          sku: prod.sku,
          priceCents: prod.price,
          description: `${prod.name} - ${prod.category}`,
          isActive: true,
          trackInventory: prod.category === "Supplies" || prod.category === "Food",
          stockQty: prod.category === "Supplies" ? randomBetween(10, 100) : 0,
        },
      });
    }
  }
  console.log(`Created ${products.length} products`);

  // ============ STORE ORDERS ============
  console.log("\n--- Creating Store Orders ---");
  const productRecords = await prisma.product.findMany({
    where: { campgroundId: campground.id },
  });

  for (let i = 0; i < 50; i++) {
    const guest = pick(guests);
    const orderProducts = [
      pick(productRecords),
      ...(randomBetween(0, 1) ? [pick(productRecords)] : []),
    ];
    const subtotal = orderProducts.reduce((sum, p) => sum + p.priceCents, 0);
    const tax = Math.round(subtotal * 0.0835);

    await prisma.storeOrder.create({
      data: {
        campgroundId: campground.id,
        guestId: guest.id,
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: subtotal + tax,
        status: pick(["completed", "completed", "completed", "pending"]),
        completedAt: pick([addDays(new Date(), -randomBetween(0, 60)), null]),
        items: {
          create: orderProducts.map((p) => {
            const qty = randomBetween(1, 3);
            return {
              product: { connect: { id: p.id } },
              name: p.name,
              qty,
              unitCents: p.priceCents,
              totalCents: p.priceCents * qty,
            };
          }),
        },
      },
    });
  }
  console.log("Created 50 store orders");

  // ============ MESSAGES ============
  console.log("\n--- Creating Messages ---");
  const guestMessageTemplates = [
    "Hi! What time is check-in?",
    "Can we request an early check-in?",
    "Is the pool open this weekend?",
    "We're running about an hour late",
    "Do you have firewood available?",
    "What's the WiFi password?",
    "Can we add an extra night?",
    "Is there a grocery store nearby?",
    "The water pressure seems low",
    "Thanks for a great stay!",
  ];
  const staffMessageTemplates = [
    "Check-in is at 3pm, but we can try to accommodate early arrivals!",
    "Yes, we have firewood available at the camp store - $8/bundle",
    "The WiFi password is on your check-in sheet",
    "No problem, see you soon!",
    "We'll have maintenance take a look at that",
    "You're welcome! Hope to see you again!",
  ];

  // Get reservations to link messages
  const reservations = await prisma.reservation.findMany({
    where: { campgroundId: campground.id },
    select: { id: true, guestId: true },
    take: 100,
  });

  for (let i = 0; i < 30; i++) {
    const res = pick(reservations);
    const isGuestMessage = randomBetween(0, 2) < 2; // 66% guest messages
    await prisma.message.create({
      data: {
        campgroundId: campground.id,
        reservationId: res.id,
        guestId: res.guestId,
        senderType: isGuestMessage ? "guest" : "staff",
        content: isGuestMessage ? pick(guestMessageTemplates) : pick(staffMessageTemplates),
        createdAt: addDays(new Date(), -randomBetween(0, 30)),
      },
    });
  }
  console.log("Created 30 messages");

  // ============ NPS RESPONSES ============
  console.log("\n--- Creating NPS Responses ---");

  // Create or get NPS survey first
  const npsSurvey = await prisma.npsSurvey.upsert({
    where: { id: "seed-nps-survey-riverbend" },
    update: {},
    create: {
      id: "seed-nps-survey-riverbend",
      campgroundId: campground.id,
      name: "Post-Stay Survey",
      question: "How likely are you to recommend us to a friend?",
      status: "active",
      channels: ["email", "inapp"],
    },
  });

  for (let i = 0; i < 40; i++) {
    const guest = pick(guests);
    const res = pick(reservations);
    const score = pick([10, 10, 10, 9, 9, 8, 8, 7, 6, 4]);

    await prisma.npsResponse.create({
      data: {
        surveyId: npsSurvey.id,
        campgroundId: campground.id,
        guestId: guest.id,
        reservationId: res.id,
        score,
        comment:
          score >= 9
            ? pick([
                "Amazing stay!",
                "Will definitely come back",
                "Best campground we've been to",
                "Love the staff here",
              ])
            : score >= 7
              ? pick(["Good overall", "Nice facilities", "Pretty good experience"])
              : pick(["Could use some improvements", "WiFi was slow", "Sites felt cramped"]),
        createdAt: addDays(new Date(), -randomBetween(0, 90)),
      },
    });
  }
  console.log("Created 40 NPS responses");

  // ============ SUMMARY ============
  console.log("\n=== Seed Complete ===");
  console.log(`
Summary for Keepr - Riverbend:
- 200 guests
- 30 seasonal guests
- ${reservationCount} reservations
- ${paymentCount} payments
- 15 maintenance tickets
- 15 products
- 50 store orders
- 30 messages
- 40 NPS responses

Linda can now log in and test all features!
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
