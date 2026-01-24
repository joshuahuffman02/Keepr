import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();
const API_BASE = "http://localhost:4000/api";

async function main() {
  console.log("Starting Promotions Verification...");

  // 1. Get a campground
  const campground = await prisma.campground.findFirst({
    where: { slug: "sunset-shores-rv-park" }, // Using a known slug from previous context
  });

  if (!campground) {
    console.error("Campground not found");
    process.exit(1);
  }
  console.log(`Using campground: ${campground.name} (${campground.id})`);

  // 2. Create a promotion
  const promoCode = `TESTPROMO${Date.now()}`;
  console.log(`Creating promotion: ${promoCode}`);

  const createPromoRes = await fetch(`${API_BASE}/promotions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campgroundId: campground.id,
      code: promoCode,
      type: "percentage",
      value: 20, // 20% off
      isActive: true,
      description: "Test Promotion",
    }),
  });

  if (!createPromoRes.ok) {
    console.error("Failed to create promotion:", await createPromoRes.text());
    process.exit(1);
  }
  const promotion = await createPromoRes.json();
  console.log("Promotion created:", promotion);

  // 3. Validate the promotion
  console.log("Validating promotion...");
  const validateRes = await fetch(`${API_BASE}/promotions/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campgroundId: campground.id,
      code: promoCode,
      subtotal: 10000, // $100.00
    }),
  });

  if (!validateRes.ok) {
    console.error("Failed to validate promotion:", await validateRes.text());
    process.exit(1);
  }
  const validation = await validateRes.json();
  console.log("Validation result:", validation);

  if (validation.discountCents !== 2000) {
    // 20% of 10000 is 2000
    console.error("Incorrect discount calculation. Expected 2000, got:", validation.discountCents);
    process.exit(1);
  }

  // 4. Create a public reservation with the promo code
  console.log("Creating public reservation with promo code...");

  // Find an available site
  const site = await prisma.site.findFirst({
    where: { campgroundId: campground.id, isActive: true },
  });

  if (!site) {
    console.error("No active site found");
    process.exit(1);
  }

  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 30); // 30 days from now
  const departureDate = new Date(arrivalDate);
  departureDate.setDate(departureDate.getDate() + 2); // 2 nights

  const reservationPayload = {
    campgroundSlug: campground.slug,
    siteId: site.id,
    arrivalDate: arrivalDate.toISOString().split("T")[0],
    departureDate: departureDate.toISOString().split("T")[0],
    adults: 2,
    guest: {
      firstName: "Promo",
      lastName: "Tester",
      email: `promo.tester.${Date.now()}@example.com`,
      phone: "555-0199",
    },
    promoCode: promoCode,
  };

  const createResRes = await fetch(`${API_BASE}/public/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservationPayload),
  });

  if (!createResRes.ok) {
    console.error("Failed to create reservation:", await createResRes.text());
    process.exit(1);
  }

  const reservation = await createResRes.json();
  console.log("Reservation created:", reservation.id);
  console.log("Total Amount:", reservation.totalAmount);
  console.log("Discounts Amount:", reservation.discountsAmount);
  console.log("Promo Code:", reservation.promoCode);

  if (reservation.discountsAmount <= 0) {
    console.error("Discount was not applied to reservation");
    process.exit(1);
  }

  if (reservation.promoCode !== promoCode) {
    console.error("Promo code was not saved on reservation");
    process.exit(1);
  }

  // 5. Verify usage count increment
  console.log("Verifying usage count...");
  const updatedPromotion = await prisma.promotion.findUnique({
    where: { id: promotion.id },
  });

  if (updatedPromotion.usageCount !== 1) {
    console.error("Usage count was not incremented. Expected 1, got:", updatedPromotion.usageCount);
    process.exit(1);
  }

  console.log("Verification Successful!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
