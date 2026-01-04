/**
 * Setup Stripe Billing Products & Prices
 *
 * Run this script ONCE to create the products, prices, and coupons in Stripe
 * for Keepr's billing tiers.
 *
 * Usage:
 *   npx ts-node src/scripts/setup-stripe-billing.ts
 *
 * Make sure STRIPE_SECRET_KEY is set in your environment (use test key for sandbox)
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY is not set");
  console.log("Set your Stripe test secret key: export STRIPE_SECRET_KEY=sk_test_...");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-12-18.acacia" as any,
});

interface CreatedResources {
  products: Record<string, string>;
  prices: Record<string, string>;
  coupons: Record<string, string>;
}

async function main() {
  console.log("Setting up Stripe billing for Keepr...\n");

  const isTestMode = (STRIPE_SECRET_KEY as string).startsWith("sk_test_");
  console.log(`Mode: ${isTestMode ? "TEST" : "LIVE"}\n`);

  if (!isTestMode) {
    console.log("WARNING: You are using a LIVE Stripe key!");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const created: CreatedResources = {
    products: {},
    prices: {},
    coupons: {},
  };

  try {
    // =========================================================================
    // 1. Create Products
    // =========================================================================
    console.log("Creating products...\n");

    // Monthly subscription product
    const subscriptionProduct = await stripe.products.create({
      name: "Keepr Subscription",
      description: "Monthly platform access for campground management",
      metadata: { type: "subscription" },
    });
    created.products.subscription = subscriptionProduct.id;
    console.log(`  [OK] Subscription product: ${subscriptionProduct.id}`);

    // Per-booking fee product
    const bookingFeeProduct = await stripe.products.create({
      name: "Keepr Per-Booking Fee",
      description: "Fee charged per reservation created",
      metadata: { type: "booking_fee" },
    });
    created.products.bookingFee = bookingFeeProduct.id;
    console.log(`  [OK] Booking fee product: ${bookingFeeProduct.id}`);

    // SMS product
    const smsProduct = await stripe.products.create({
      name: "Keepr SMS",
      description: "SMS messaging charges",
      metadata: { type: "sms" },
    });
    created.products.sms = smsProduct.id;
    console.log(`  [OK] SMS product: ${smsProduct.id}`);

    // =========================================================================
    // 2. Create Prices for Standard Tier
    // =========================================================================
    console.log("\nCreating prices for Standard tier...\n");

    // Standard monthly: $69/month
    const standardMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 6900,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "standard", type: "monthly" },
      nickname: "Standard Monthly - $69",
    });
    created.prices.standardMonthly = standardMonthly.id;
    console.log(`  [OK] Standard monthly ($69): ${standardMonthly.id}`);

    // Standard per-booking: $2.50 (metered)
    const standardBookingFee = await stripe.prices.create({
      product: bookingFeeProduct.id,
      unit_amount: 250,
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { tier: "standard", type: "booking_fee" },
      nickname: "Standard Per-Booking - $2.50",
    });
    created.prices.standardBookingFee = standardBookingFee.id;
    console.log(`  [OK] Standard booking fee ($2.50): ${standardBookingFee.id}`);

    // =========================================================================
    // 3. Create Prices for Early Access Tiers
    // =========================================================================
    console.log("\nCreating prices for Early Access tiers...\n");

    // --- Founder's Circle ---
    // $0/month forever, $0.75/booking
    const foundersMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 0,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "founders_circle", type: "monthly" },
      nickname: "Founders Circle Monthly - $0",
    });
    created.prices.foundersMonthly = foundersMonthly.id;
    console.log(`  [OK] Founders monthly ($0): ${foundersMonthly.id}`);

    const foundersBookingFee = await stripe.prices.create({
      product: bookingFeeProduct.id,
      unit_amount: 75,
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { tier: "founders_circle", type: "booking_fee" },
      nickname: "Founders Circle Per-Booking - $0.75",
    });
    created.prices.foundersBookingFee = foundersBookingFee.id;
    console.log(`  [OK] Founders booking fee ($0.75): ${foundersBookingFee.id}`);

    // --- Pioneer ---
    // $0/month for 12 months, then $29/month, $1.00/booking
    const pioneerMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 0,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "pioneer", type: "monthly", promo: "true" },
      nickname: "Pioneer Monthly - $0 (promo)",
    });
    created.prices.pioneerMonthly = pioneerMonthly.id;
    console.log(`  [OK] Pioneer monthly ($0 promo): ${pioneerMonthly.id}`);

    const pioneerPostPromoMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 2900,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "pioneer", type: "monthly", promo: "false" },
      nickname: "Pioneer Monthly - $29 (post-promo)",
    });
    created.prices.pioneerPostPromoMonthly = pioneerPostPromoMonthly.id;
    console.log(`  [OK] Pioneer monthly ($29 post-promo): ${pioneerPostPromoMonthly.id}`);

    const pioneerBookingFee = await stripe.prices.create({
      product: bookingFeeProduct.id,
      unit_amount: 100,
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { tier: "pioneer", type: "booking_fee" },
      nickname: "Pioneer Per-Booking - $1.00",
    });
    created.prices.pioneerBookingFee = pioneerBookingFee.id;
    console.log(`  [OK] Pioneer booking fee ($1.00): ${pioneerBookingFee.id}`);

    // --- Trailblazer ---
    // $14.50/month for 6 months, then $29/month, $1.25/booking
    const trailblazerMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 1450,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "trailblazer", type: "monthly", promo: "true" },
      nickname: "Trailblazer Monthly - $14.50 (promo)",
    });
    created.prices.trailblazerMonthly = trailblazerMonthly.id;
    console.log(`  [OK] Trailblazer monthly ($14.50 promo): ${trailblazerMonthly.id}`);

    const trailblazerPostPromoMonthly = await stripe.prices.create({
      product: subscriptionProduct.id,
      unit_amount: 2900,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "trailblazer", type: "monthly", promo: "false" },
      nickname: "Trailblazer Monthly - $29 (post-promo)",
    });
    created.prices.trailblazerPostPromoMonthly = trailblazerPostPromoMonthly.id;
    console.log(`  [OK] Trailblazer monthly ($29 post-promo): ${trailblazerPostPromoMonthly.id}`);

    const trailblazerBookingFee = await stripe.prices.create({
      product: bookingFeeProduct.id,
      unit_amount: 125,
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { tier: "trailblazer", type: "booking_fee" },
      nickname: "Trailblazer Per-Booking - $1.25",
    });
    created.prices.trailblazerBookingFee = trailblazerBookingFee.id;
    console.log(`  [OK] Trailblazer booking fee ($1.25): ${trailblazerBookingFee.id}`);

    // =========================================================================
    // 4. Create SMS Prices
    // =========================================================================
    console.log("\nCreating SMS prices...\n");

    const smsOutbound = await stripe.prices.create({
      product: smsProduct.id,
      unit_amount: 10, // $0.10
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { type: "sms_outbound" },
      nickname: "SMS Outbound - $0.10",
    });
    created.prices.smsOutbound = smsOutbound.id;
    console.log(`  [OK] SMS outbound ($0.10): ${smsOutbound.id}`);

    const smsInbound = await stripe.prices.create({
      product: smsProduct.id,
      unit_amount: 4, // $0.04
      currency: "usd",
      recurring: {
        interval: "month",
        usage_type: "metered",
      } as any,
      metadata: { type: "sms_inbound" },
      nickname: "SMS Inbound - $0.04",
    });
    created.prices.smsInbound = smsInbound.id;
    console.log(`  [OK] SMS inbound ($0.04): ${smsInbound.id}`);

    // =========================================================================
    // 5. Create Coupons for Early Access
    // =========================================================================
    console.log("\nCreating coupons...\n");

    // Pioneer: 100% off for 12 months
    const pioneerCoupon = await stripe.coupons.create({
      percent_off: 100,
      duration: "repeating",
      duration_in_months: 12,
      name: "Pioneer Early Access - 12 Months Free",
      metadata: { tier: "pioneer" },
    });
    created.coupons.pioneer = pioneerCoupon.id;
    console.log(`  [OK] Pioneer coupon (12mo free): ${pioneerCoupon.id}`);

    // Trailblazer: 50% off for 6 months
    const trailblazerCoupon = await stripe.coupons.create({
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 6,
      name: "Trailblazer - 50% Off 6 Months",
      metadata: { tier: "trailblazer" },
    });
    created.coupons.trailblazer = trailblazerCoupon.id;
    console.log(`  [OK] Trailblazer coupon (6mo 50% off): ${trailblazerCoupon.id}`);

    // Founder's Circle: Forever free (100% off forever)
    const foundersCoupon = await stripe.coupons.create({
      percent_off: 100,
      duration: "forever",
      name: "Founders Circle - Forever Free",
      metadata: { tier: "founders_circle" },
    });
    created.coupons.founders = foundersCoupon.id;
    console.log(`  [OK] Founders coupon (forever free): ${foundersCoupon.id}`);

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("\n" + "=".repeat(60));
    console.log("SETUP COMPLETE!");
    console.log("=".repeat(60) + "\n");

    console.log("Add these IDs to your environment variables:\n");
    console.log("# Stripe Products");
    console.log(`STRIPE_PRODUCT_SUBSCRIPTION=${created.products.subscription}`);
    console.log(`STRIPE_PRODUCT_BOOKING_FEE=${created.products.bookingFee}`);
    console.log(`STRIPE_PRODUCT_SMS=${created.products.sms}`);
    console.log("");
    console.log("# Stripe Prices - Standard");
    console.log(`STRIPE_PRICE_STANDARD_MONTHLY=${created.prices.standardMonthly}`);
    console.log(`STRIPE_PRICE_STANDARD_BOOKING_FEE=${created.prices.standardBookingFee}`);
    console.log("");
    console.log("# Stripe Prices - Founders Circle");
    console.log(`STRIPE_PRICE_FOUNDERS_MONTHLY=${created.prices.foundersMonthly}`);
    console.log(`STRIPE_PRICE_FOUNDERS_BOOKING_FEE=${created.prices.foundersBookingFee}`);
    console.log("");
    console.log("# Stripe Prices - Pioneer");
    console.log(`STRIPE_PRICE_PIONEER_MONTHLY=${created.prices.pioneerMonthly}`);
    console.log(`STRIPE_PRICE_PIONEER_POST_PROMO_MONTHLY=${created.prices.pioneerPostPromoMonthly}`);
    console.log(`STRIPE_PRICE_PIONEER_BOOKING_FEE=${created.prices.pioneerBookingFee}`);
    console.log("");
    console.log("# Stripe Prices - Trailblazer");
    console.log(`STRIPE_PRICE_TRAILBLAZER_MONTHLY=${created.prices.trailblazerMonthly}`);
    console.log(`STRIPE_PRICE_TRAILBLAZER_POST_PROMO_MONTHLY=${created.prices.trailblazerPostPromoMonthly}`);
    console.log(`STRIPE_PRICE_TRAILBLAZER_BOOKING_FEE=${created.prices.trailblazerBookingFee}`);
    console.log("");
    console.log("# Stripe Prices - SMS");
    console.log(`STRIPE_PRICE_SMS_OUTBOUND=${created.prices.smsOutbound}`);
    console.log(`STRIPE_PRICE_SMS_INBOUND=${created.prices.smsInbound}`);
    console.log("");
    console.log("# Stripe Coupons");
    console.log(`STRIPE_COUPON_FOUNDERS=${created.coupons.founders}`);
    console.log(`STRIPE_COUPON_PIONEER=${created.coupons.pioneer}`);
    console.log(`STRIPE_COUPON_TRAILBLAZER=${created.coupons.trailblazer}`);

  } catch (error) {
    console.error("\nERROR setting up Stripe:", error);
    process.exit(1);
  }
}

main();
