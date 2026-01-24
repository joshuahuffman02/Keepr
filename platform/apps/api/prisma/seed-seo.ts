/**
 * SEO Data Seeding Script
 *
 * Seeds initial campground and location data for SEO pages.
 * Run with: npx ts-node prisma/seed-seo.ts
 */

import { AttractionType, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// Sample state data
const STATES = [
  { name: "California", slug: "california", abbr: "CA" },
  { name: "Colorado", slug: "colorado", abbr: "CO" },
  { name: "Utah", slug: "utah", abbr: "UT" },
  { name: "Arizona", slug: "arizona", abbr: "AZ" },
  { name: "Oregon", slug: "oregon", abbr: "OR" },
  { name: "Washington", slug: "washington", abbr: "WA" },
  { name: "Montana", slug: "montana", abbr: "MT" },
  { name: "Wyoming", slug: "wyoming", abbr: "WY" },
  { name: "Texas", slug: "texas", abbr: "TX" },
  { name: "Florida", slug: "florida", abbr: "FL" },
];

// Sample attractions (national parks)
type AttractionSeed = {
  name: string;
  slug: string;
  type: AttractionType;
  state: string;
  latitude: number;
  longitude: number;
  description: string;
  activities: string[];
  bestSeason: string;
};

const ATTRACTIONS: AttractionSeed[] = [
  {
    name: "Yellowstone National Park",
    slug: "yellowstone-national-park",
    type: "national_park",
    state: "Wyoming",
    latitude: 44.428,
    longitude: -110.5885,
    description:
      "The world's first national park, featuring geysers, hot springs, and diverse wildlife.",
    activities: ["Hiking", "Wildlife Viewing", "Camping", "Fishing", "Photography"],
    bestSeason: "June through September",
  },
  {
    name: "Yosemite National Park",
    slug: "yosemite-national-park",
    type: "national_park",
    state: "California",
    latitude: 37.8651,
    longitude: -119.5383,
    description:
      "Famous for its granite cliffs, waterfalls, giant sequoias, and biological diversity.",
    activities: ["Rock Climbing", "Hiking", "Camping", "Photography", "Backpacking"],
    bestSeason: "May through October",
  },
  {
    name: "Grand Canyon National Park",
    slug: "grand-canyon-national-park",
    type: "national_park",
    state: "Arizona",
    latitude: 36.0544,
    longitude: -112.1401,
    description: "One of the most spectacular examples of erosion in the world.",
    activities: ["Hiking", "Rafting", "Camping", "Mule Rides", "Photography"],
    bestSeason: "March through May, September through November",
  },
  {
    name: "Zion National Park",
    slug: "zion-national-park",
    type: "national_park",
    state: "Utah",
    latitude: 37.2982,
    longitude: -113.0263,
    description: "Known for its stunning red cliffs, canyons, and emerald pools.",
    activities: ["Hiking", "Canyoneering", "Camping", "Rock Climbing", "Photography"],
    bestSeason: "April through October",
  },
  {
    name: "Rocky Mountain National Park",
    slug: "rocky-mountain-national-park",
    type: "national_park",
    state: "Colorado",
    latitude: 40.3428,
    longitude: -105.6836,
    description: "Features majestic mountain views, alpine lakes, and diverse wildlife.",
    activities: ["Hiking", "Wildlife Viewing", "Camping", "Fishing", "Scenic Drives"],
    bestSeason: "June through September",
  },
];

// Sample campgrounds
const CAMPGROUNDS = [
  {
    name: "Pines Campground at Yellowstone",
    slug: "pines-campground-yellowstone",
    city: "West Yellowstone",
    state: "Montana",
    address: "123 Campground Road",
    zipCode: "59758",
    latitude: 44.6621,
    longitude: -111.0952,
    phone: "(406) 555-0101",
    website: "https://example.com/pines-yellowstone",
    description:
      "A beautiful campground near Yellowstone's west entrance with full hookups and stunning mountain views.",
    amenities: ["Full Hookups", "WiFi", "Showers", "Laundry", "Camp Store", "Pet Friendly"],
    siteTypes: ["RV Sites", "Tent Sites", "Cabins"],
    totalSites: 150,
  },
  {
    name: "Yosemite Valley Campground",
    slug: "yosemite-valley-campground",
    city: "Yosemite Valley",
    state: "California",
    address: "9035 Village Drive",
    zipCode: "95389",
    latitude: 37.746,
    longitude: -119.5945,
    phone: "(209) 555-0202",
    website: "https://example.com/yosemite-valley",
    description:
      "Iconic camping in the heart of Yosemite Valley with views of El Capitan and Half Dome.",
    amenities: ["Flush Toilets", "Showers", "Bear Boxes", "Picnic Tables", "Fire Rings"],
    siteTypes: ["Tent Sites", "RV Sites"],
    totalSites: 400,
  },
  {
    name: "Grand Canyon Mather Campground",
    slug: "grand-canyon-mather-campground",
    city: "Grand Canyon",
    state: "Arizona",
    address: "1 Market Plaza Rd",
    zipCode: "86023",
    latitude: 36.0567,
    longitude: -112.1074,
    phone: "(928) 555-0303",
    website: "https://example.com/mather-campground",
    description:
      "The largest campground on the South Rim with easy access to trails and shuttle services.",
    amenities: ["Flush Toilets", "Showers", "Coin Laundry", "Camp Store", "WiFi"],
    siteTypes: ["Tent Sites", "RV Sites"],
    totalSites: 319,
  },
  {
    name: "Zion Canyon Campground",
    slug: "zion-canyon-campground",
    city: "Springdale",
    state: "Utah",
    address: "479 Zion Park Blvd",
    zipCode: "84767",
    latitude: 37.1899,
    longitude: -112.9984,
    phone: "(435) 555-0404",
    website: "https://example.com/zion-canyon",
    description:
      "Premium camping at the doorstep of Zion National Park with river access and mountain views.",
    amenities: ["Full Hookups", "WiFi", "Pool", "Hot Tub", "Playground", "Pet Friendly"],
    siteTypes: ["RV Sites", "Tent Sites", "Glamping Tents"],
    totalSites: 200,
  },
  {
    name: "Rocky Mountain Aspenglen Campground",
    slug: "rocky-mountain-aspenglen",
    city: "Estes Park",
    state: "Colorado",
    address: "Fall River Entrance Rd",
    zipCode: "80517",
    latitude: 40.3996,
    longitude: -105.5943,
    phone: "(970) 555-0505",
    website: "https://example.com/aspenglen",
    description:
      "Peaceful camping surrounded by aspens near Rocky Mountain National Park's Fall River entrance.",
    amenities: ["Flush Toilets", "Potable Water", "Bear Boxes", "Picnic Tables", "Fire Rings"],
    siteTypes: ["Tent Sites"],
    totalSites: 54,
  },
  {
    name: "Lake Powell RV Resort",
    slug: "lake-powell-rv-resort",
    city: "Page",
    state: "Arizona",
    address: "3800 N Navajo Dr",
    zipCode: "86040",
    latitude: 36.9353,
    longitude: -111.4683,
    phone: "(928) 555-0606",
    website: "https://example.com/lake-powell-rv",
    description:
      "Full-service RV resort with stunning lake views and easy access to Horseshoe Bend and Antelope Canyon.",
    amenities: ["Full Hookups", "WiFi", "Pool", "Hot Tub", "Fitness Center", "Restaurant"],
    siteTypes: ["RV Sites", "Cabins"],
    totalSites: 180,
  },
  {
    name: "Sequoia Redwood Grove Camp",
    slug: "sequoia-redwood-grove",
    city: "Three Rivers",
    state: "California",
    address: "47050 Generals Hwy",
    zipCode: "93271",
    latitude: 36.4864,
    longitude: -118.5715,
    phone: "(559) 555-0707",
    website: "https://example.com/sequoia-grove",
    description:
      "Camp among the giants in the Sequoia National Forest with stunning old-growth redwoods.",
    amenities: ["Vault Toilets", "Potable Water", "Bear Boxes", "Picnic Tables"],
    siteTypes: ["Tent Sites", "Small RV Sites"],
    totalSites: 65,
  },
  {
    name: "Big Sur Coast Campground",
    slug: "big-sur-coast-campground",
    city: "Big Sur",
    state: "California",
    address: "47231 Highway 1",
    zipCode: "93920",
    latitude: 36.244,
    longitude: -121.8077,
    phone: "(831) 555-0808",
    website: "https://example.com/big-sur-coast",
    description:
      "Dramatic coastal camping on the famous Big Sur coastline with ocean views and redwood forests.",
    amenities: ["Flush Toilets", "Fire Pits", "Picnic Tables", "Beach Access"],
    siteTypes: ["Tent Sites", "Walk-in Sites"],
    totalSites: 32,
  },
];

async function main() {
  console.log("Starting SEO data seeding...");

  // 1. Seed States (SeoLocation)
  console.log("Seeding states...");
  for (const state of STATES) {
    await prisma.seoLocation.upsert({
      where: { slug: state.slug },
      update: {},
      create: {
        type: "state",
        name: state.name,
        slug: state.slug,
        state: state.abbr,
        country: "USA",
        isPublished: true,
        publishedAt: new Date(),
        campgroundCount: 0, // Will update after campgrounds are seeded
      },
    });
    console.log(`  Created state: ${state.name}`);
  }

  // 2. Seed Attractions
  console.log("\nSeeding attractions...");
  for (const attr of ATTRACTIONS) {
    await prisma.attraction.upsert({
      where: { slug: attr.slug },
      update: {},
      create: {
        type: attr.type,
        name: attr.name,
        slug: attr.slug,
        state: attr.state,
        latitude: attr.latitude,
        longitude: attr.longitude,
        description: attr.description,
        activities: attr.activities,
        bestSeason: attr.bestSeason,
        isPublished: true,
        publishedAt: new Date(),
        nearbyCampgroundCount: 0, // Will update after associations
      },
    });
    console.log(`  Created attraction: ${attr.name}`);
  }

  // 3. Seed Campgrounds
  console.log("\nSeeding campgrounds...");
  for (const cg of CAMPGROUNDS) {
    // Need an organization for the campground
    let org = await prisma.organization.findFirst({
      where: { name: "SEO Demo Organization" },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "SEO Demo Organization",
        },
      });
      console.log("  Created demo organization");
    }

    // Check if campground already exists
    const existing = await prisma.campground.findFirst({
      where: { slug: cg.slug },
    });

    if (!existing) {
      await prisma.campground.create({
        data: {
          organizationId: org.id,
          name: cg.name,
          slug: cg.slug,
          city: cg.city,
          state: cg.state,
          address1: cg.address,
          postalCode: cg.zipCode,
          latitude: cg.latitude,
          longitude: cg.longitude,
          phone: cg.phone,
          website: cg.website,
          description: cg.description,
          timezone: "America/Denver",
          // SEO fields
          claimStatus: "unclaimed",
          seededDataSource: "manual",
          seededAt: new Date(),
        },
      });
      console.log(`  Created campground: ${cg.name}`);
    } else {
      console.log(`  Skipped (exists): ${cg.name}`);
    }
  }

  // 4. Update state campground counts
  console.log("\nUpdating state campground counts...");
  for (const state of STATES) {
    const count = await prisma.campground.count({
      where: { state: state.name, deletedAt: null },
    });

    await prisma.seoLocation.update({
      where: { slug: state.slug },
      data: { campgroundCount: count },
    });

    if (count > 0) {
      console.log(`  ${state.name}: ${count} campgrounds`);
    }
  }

  // 5. Create campground-attraction associations
  console.log("\nCreating campground-attraction associations...");
  const campgrounds = await prisma.campground.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  const attractions = await prisma.attraction.findMany({
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  for (const cg of campgrounds) {
    if (!cg.latitude || !cg.longitude) continue;

    for (const attr of attractions) {
      // Calculate distance using Haversine formula
      const distance = calculateDistance(
        Number(cg.latitude),
        Number(cg.longitude),
        Number(attr.latitude),
        Number(attr.longitude),
      );

      // Only associate if within 100 miles
      if (distance <= 100) {
        await prisma.campgroundAttraction.upsert({
          where: {
            campgroundId_attractionId: {
              campgroundId: cg.id,
              attractionId: attr.id,
            },
          },
          update: { distanceMiles: distance },
          create: {
            campgroundId: cg.id,
            attractionId: attr.id,
            distanceMiles: distance,
            isNearby: distance <= 50,
          },
        });
        console.log(`  ${cg.name} <-> ${attr.name}: ${distance.toFixed(1)} mi`);
      }
    }
  }

  // 6. Update attraction campground counts
  console.log("\nUpdating attraction campground counts...");
  for (const attr of attractions) {
    const count = await prisma.campgroundAttraction.count({
      where: { attractionId: attr.id },
    });

    await prisma.attraction.update({
      where: { id: attr.id },
      data: { nearbyCampgroundCount: count },
    });

    if (count > 0) {
      console.log(`  ${attr.name}: ${count} nearby campgrounds`);
    }
  }

  console.log("\nSEO data seeding complete!");
}

// Haversine formula for calculating distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
