/**
 * Seed SEO Locations and Attractions
 *
 * This script seeds:
 * 1. All US states as SeoLocation records
 * 2. Major national parks as Attraction records
 * 3. Associates campgrounds with their state locations
 * 4. Associates campgrounds with nearby attractions
 * 5. Updates stats and auto-publishes
 *
 * Usage:
 *   DATABASE_URL="..." npx ts-node scripts/seed-seo-locations.ts
 */

import { PrismaClient, SeoLocationType, AttractionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// US States data
const US_STATES = [
  { code: "AL", name: "Alabama", lat: 32.806671, lng: -86.79113 },
  { code: "AK", name: "Alaska", lat: 61.370716, lng: -152.404419 },
  { code: "AZ", name: "Arizona", lat: 33.729759, lng: -111.431221 },
  { code: "AR", name: "Arkansas", lat: 34.969704, lng: -92.373123 },
  { code: "CA", name: "California", lat: 36.116203, lng: -119.681564 },
  { code: "CO", name: "Colorado", lat: 39.059811, lng: -105.311104 },
  { code: "CT", name: "Connecticut", lat: 41.597782, lng: -72.755371 },
  { code: "DE", name: "Delaware", lat: 39.318523, lng: -75.507141 },
  { code: "FL", name: "Florida", lat: 27.766279, lng: -81.686783 },
  { code: "GA", name: "Georgia", lat: 33.040619, lng: -83.643074 },
  { code: "HI", name: "Hawaii", lat: 21.094318, lng: -157.498337 },
  { code: "ID", name: "Idaho", lat: 44.240459, lng: -114.478828 },
  { code: "IL", name: "Illinois", lat: 40.349457, lng: -88.986137 },
  { code: "IN", name: "Indiana", lat: 39.849426, lng: -86.258278 },
  { code: "IA", name: "Iowa", lat: 42.011539, lng: -93.210526 },
  { code: "KS", name: "Kansas", lat: 38.5266, lng: -96.726486 },
  { code: "KY", name: "Kentucky", lat: 37.66814, lng: -84.670067 },
  { code: "LA", name: "Louisiana", lat: 31.169546, lng: -91.867805 },
  { code: "ME", name: "Maine", lat: 44.693947, lng: -69.381927 },
  { code: "MD", name: "Maryland", lat: 39.063946, lng: -76.802101 },
  { code: "MA", name: "Massachusetts", lat: 42.230171, lng: -71.530106 },
  { code: "MI", name: "Michigan", lat: 43.326618, lng: -84.536095 },
  { code: "MN", name: "Minnesota", lat: 45.694454, lng: -93.900192 },
  { code: "MS", name: "Mississippi", lat: 32.741646, lng: -89.678696 },
  { code: "MO", name: "Missouri", lat: 38.456085, lng: -92.288368 },
  { code: "MT", name: "Montana", lat: 46.921925, lng: -110.454353 },
  { code: "NE", name: "Nebraska", lat: 41.12537, lng: -98.268082 },
  { code: "NV", name: "Nevada", lat: 38.313515, lng: -117.055374 },
  { code: "NH", name: "New Hampshire", lat: 43.452492, lng: -71.563896 },
  { code: "NJ", name: "New Jersey", lat: 40.298904, lng: -74.521011 },
  { code: "NM", name: "New Mexico", lat: 34.840515, lng: -106.248482 },
  { code: "NY", name: "New York", lat: 42.165726, lng: -74.948051 },
  { code: "NC", name: "North Carolina", lat: 35.630066, lng: -79.806419 },
  { code: "ND", name: "North Dakota", lat: 47.528912, lng: -99.784012 },
  { code: "OH", name: "Ohio", lat: 40.388783, lng: -82.764915 },
  { code: "OK", name: "Oklahoma", lat: 35.565342, lng: -96.928917 },
  { code: "OR", name: "Oregon", lat: 44.572021, lng: -122.070938 },
  { code: "PA", name: "Pennsylvania", lat: 40.590752, lng: -77.209755 },
  { code: "RI", name: "Rhode Island", lat: 41.680893, lng: -71.51178 },
  { code: "SC", name: "South Carolina", lat: 33.856892, lng: -80.945007 },
  { code: "SD", name: "South Dakota", lat: 44.299782, lng: -99.438828 },
  { code: "TN", name: "Tennessee", lat: 35.747845, lng: -86.692345 },
  { code: "TX", name: "Texas", lat: 31.054487, lng: -97.563461 },
  { code: "UT", name: "Utah", lat: 40.150032, lng: -111.862434 },
  { code: "VT", name: "Vermont", lat: 44.045876, lng: -72.710686 },
  { code: "VA", name: "Virginia", lat: 37.769337, lng: -78.169968 },
  { code: "WA", name: "Washington", lat: 47.400902, lng: -121.490494 },
  { code: "WV", name: "West Virginia", lat: 38.491226, lng: -80.954453 },
  { code: "WI", name: "Wisconsin", lat: 44.268543, lng: -89.616508 },
  { code: "WY", name: "Wyoming", lat: 42.755966, lng: -107.30249 },
];

// Major National Parks
const NATIONAL_PARKS = [
  {
    name: "Yosemite National Park",
    slug: "yosemite-national-park",
    state: "CA",
    lat: 37.8651,
    lng: -119.5383,
    npsCode: "YOSE",
    activities: ["hiking", "rock climbing", "camping", "photography", "wildlife viewing"],
  },
  {
    name: "Yellowstone National Park",
    slug: "yellowstone-national-park",
    state: "WY",
    lat: 44.428,
    lng: -110.5885,
    npsCode: "YELL",
    activities: ["hiking", "wildlife viewing", "geysers", "camping", "fishing"],
  },
  {
    name: "Grand Canyon National Park",
    slug: "grand-canyon-national-park",
    state: "AZ",
    lat: 36.0544,
    lng: -112.1401,
    npsCode: "GRCA",
    activities: ["hiking", "rafting", "camping", "photography", "mule rides"],
  },
  {
    name: "Zion National Park",
    slug: "zion-national-park",
    state: "UT",
    lat: 37.2982,
    lng: -113.0263,
    npsCode: "ZION",
    activities: ["hiking", "canyoneering", "rock climbing", "camping", "photography"],
  },
  {
    name: "Joshua Tree National Park",
    slug: "joshua-tree-national-park",
    state: "CA",
    lat: 33.8734,
    lng: -115.901,
    npsCode: "JOTR",
    activities: ["rock climbing", "hiking", "stargazing", "camping", "photography"],
  },
  {
    name: "Acadia National Park",
    slug: "acadia-national-park",
    state: "ME",
    lat: 44.3386,
    lng: -68.2733,
    npsCode: "ACAD",
    activities: ["hiking", "biking", "kayaking", "camping", "wildlife viewing"],
  },
  {
    name: "Rocky Mountain National Park",
    slug: "rocky-mountain-national-park",
    state: "CO",
    lat: 40.3428,
    lng: -105.6836,
    npsCode: "ROMO",
    activities: ["hiking", "wildlife viewing", "camping", "fishing", "photography"],
  },
  {
    name: "Olympic National Park",
    slug: "olympic-national-park",
    state: "WA",
    lat: 47.8021,
    lng: -123.6044,
    npsCode: "OLYM",
    activities: ["hiking", "camping", "fishing", "wildlife viewing", "beach walks"],
  },
  {
    name: "Glacier National Park",
    slug: "glacier-national-park",
    state: "MT",
    lat: 48.7596,
    lng: -113.787,
    npsCode: "GLAC",
    activities: ["hiking", "camping", "wildlife viewing", "photography", "boating"],
  },
  {
    name: "Grand Teton National Park",
    slug: "grand-teton-national-park",
    state: "WY",
    lat: 43.7904,
    lng: -110.6818,
    npsCode: "GRTE",
    activities: ["hiking", "climbing", "camping", "fishing", "wildlife viewing"],
  },
  {
    name: "Arches National Park",
    slug: "arches-national-park",
    state: "UT",
    lat: 38.7331,
    lng: -109.5925,
    npsCode: "ARCH",
    activities: ["hiking", "photography", "stargazing", "camping"],
  },
  {
    name: "Bryce Canyon National Park",
    slug: "bryce-canyon-national-park",
    state: "UT",
    lat: 37.593,
    lng: -112.1871,
    npsCode: "BRCA",
    activities: ["hiking", "stargazing", "photography", "horseback riding"],
  },
  {
    name: "Death Valley National Park",
    slug: "death-valley-national-park",
    state: "CA",
    lat: 36.5054,
    lng: -117.0794,
    npsCode: "DEVA",
    activities: ["hiking", "stargazing", "photography", "camping"],
  },
  {
    name: "Sequoia National Park",
    slug: "sequoia-national-park",
    state: "CA",
    lat: 36.4864,
    lng: -118.5658,
    npsCode: "SEQU",
    activities: ["hiking", "camping", "wildlife viewing", "photography"],
  },
  {
    name: "Great Smoky Mountains National Park",
    slug: "great-smoky-mountains-national-park",
    state: "TN",
    lat: 35.6532,
    lng: -83.507,
    npsCode: "GRSM",
    activities: ["hiking", "camping", "fishing", "wildlife viewing", "waterfall viewing"],
  },
  {
    name: "Shenandoah National Park",
    slug: "shenandoah-national-park",
    state: "VA",
    lat: 38.2928,
    lng: -78.6796,
    npsCode: "SHEN",
    activities: ["hiking", "camping", "wildlife viewing", "scenic drives"],
  },
  {
    name: "Mount Rainier National Park",
    slug: "mount-rainier-national-park",
    state: "WA",
    lat: 46.88,
    lng: -121.7269,
    npsCode: "MORA",
    activities: ["hiking", "climbing", "camping", "wildflower viewing"],
  },
  {
    name: "Crater Lake National Park",
    slug: "crater-lake-national-park",
    state: "OR",
    lat: 42.8684,
    lng: -122.1685,
    npsCode: "CRLA",
    activities: ["hiking", "swimming", "camping", "photography"],
  },
  {
    name: "Big Bend National Park",
    slug: "big-bend-national-park",
    state: "TX",
    lat: 29.25,
    lng: -103.25,
    npsCode: "BIBE",
    activities: ["hiking", "camping", "stargazing", "hot springs", "rafting"],
  },
  {
    name: "Everglades National Park",
    slug: "everglades-national-park",
    state: "FL",
    lat: 25.2866,
    lng: -80.8987,
    npsCode: "EVER",
    activities: ["kayaking", "wildlife viewing", "camping", "fishing", "airboat tours"],
  },
];

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function seedStates() {
  console.log("Seeding US states...");

  let created = 0;
  for (const state of US_STATES) {
    const slug = state.name.toLowerCase().replace(/\s+/g, "-");

    await prisma.seoLocation.upsert({
      where: { slug },
      update: {
        name: state.name,
        state: state.code,
        latitude: state.lat,
        longitude: state.lng,
      },
      create: {
        type: SeoLocationType.state,
        name: state.name,
        slug,
        state: state.code,
        country: "USA",
        latitude: state.lat,
        longitude: state.lng,
        metaTitle: `Camping in ${state.name} - Best Campgrounds & RV Parks`,
        metaDescription: `Discover the best campgrounds and RV parks in ${state.name}. Find tent sites, RV hookups, cabins, and more for your next outdoor adventure.`,
        isPublished: true,
      },
    });
    created++;
  }

  console.log(`Seeded ${created} states`);
  return created;
}

async function seedNationalParks() {
  console.log("Seeding national parks...");

  let created = 0;
  for (const park of NATIONAL_PARKS) {
    await prisma.attraction.upsert({
      where: { slug: park.slug },
      update: {
        name: park.name,
        state: park.state,
        latitude: park.lat,
        longitude: park.lng,
        npsCode: park.npsCode,
        activities: park.activities,
      },
      create: {
        type: AttractionType.national_park,
        name: park.name,
        slug: park.slug,
        state: park.state,
        country: "USA",
        latitude: park.lat,
        longitude: park.lng,
        npsCode: park.npsCode,
        activities: park.activities,
        metaTitle: `Camping Near ${park.name} - Best Campgrounds & RV Parks`,
        metaDescription: `Find the best campgrounds and RV parks near ${park.name}. Book tent sites, RV hookups, and cabins close to one of America's most beautiful national parks.`,
        bestSeason: "spring-fall",
        isPublished: true,
      },
    });
    created++;
  }

  console.log(`Seeded ${created} national parks`);
  return created;
}

async function associateCampgroundsWithStates() {
  console.log("Associating campgrounds with states...");

  // Get all campgrounds with state info
  const campgrounds = await prisma.campground.findMany({
    where: {
      state: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(`Found ${campgrounds.length} campgrounds to associate`);

  // Get all state locations
  const states = await prisma.seoLocation.findMany({
    where: { type: SeoLocationType.state },
    select: { id: true, state: true },
  });

  const stateMap = new Map(states.map((s) => [s.state, s.id]));

  let associated = 0;
  for (const cg of campgrounds) {
    const locationId = stateMap.get(cg.state!);
    if (!locationId) continue;

    try {
      await prisma.campgroundLocation.upsert({
        where: {
          campgroundId_locationId: {
            campgroundId: cg.id,
            locationId,
          },
        },
        update: { isPrimary: true },
        create: {
          campgroundId: cg.id,
          locationId,
          isPrimary: true,
        },
      });
      associated++;
    } catch (e) {
      // Skip duplicates
    }
  }

  console.log(`Associated ${associated} campgrounds with states`);
  return associated;
}

async function associateCampgroundsWithAttractions() {
  console.log("Associating campgrounds with nearby attractions...");

  // Get all campgrounds with lat/lng
  const campgrounds = await prisma.campground.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(`Found ${campgrounds.length} campgrounds with coordinates`);

  // Get all attractions
  const attractions = await prisma.attraction.findMany({
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(`Found ${attractions.length} attractions`);

  const MAX_DISTANCE = 75; // miles
  let associated = 0;

  for (const cg of campgrounds) {
    if (!cg.latitude || !cg.longitude) continue;

    const cgLat = Number(cg.latitude);
    const cgLng = Number(cg.longitude);

    for (const attr of attractions) {
      const attrLat = Number(attr.latitude);
      const attrLng = Number(attr.longitude);

      const distance = calculateDistance(cgLat, cgLng, attrLat, attrLng);

      if (distance <= MAX_DISTANCE) {
        try {
          await prisma.campgroundAttraction.upsert({
            where: {
              campgroundId_attractionId: {
                campgroundId: cg.id,
                attractionId: attr.id,
              },
            },
            update: {
              distanceMiles: distance,
              isNearby: distance <= 50,
            },
            create: {
              campgroundId: cg.id,
              attractionId: attr.id,
              distanceMiles: distance,
              isNearby: distance <= 50,
            },
          });
          associated++;
        } catch (e) {
          // Skip errors
        }
      }
    }
  }

  console.log(`Created ${associated} campground-attraction associations`);
  return associated;
}

async function updateLocationStats() {
  console.log("Updating location stats...");

  // Update campground count for each state
  const locations = await prisma.seoLocation.findMany({
    where: { type: SeoLocationType.state },
    select: { id: true, slug: true },
  });

  for (const loc of locations) {
    const count = await prisma.campgroundLocation.count({
      where: { locationId: loc.id },
    });

    await prisma.seoLocation.update({
      where: { id: loc.id },
      data: {
        campgroundCount: count,
        statsUpdatedAt: new Date(),
      },
    });
  }

  console.log(`Updated stats for ${locations.length} locations`);
}

async function updateAttractionStats() {
  console.log("Updating attraction stats...");

  const attractions = await prisma.attraction.findMany({
    select: { id: true },
  });

  for (const attr of attractions) {
    const count = await prisma.campgroundAttraction.count({
      where: { attractionId: attr.id, isNearby: true },
    });

    await prisma.attraction.update({
      where: { id: attr.id },
      data: {
        nearbyCampgroundCount: count,
        statsUpdatedAt: new Date(),
      },
    });
  }

  console.log(`Updated stats for ${attractions.length} attractions`);
}

async function main() {
  console.log("Starting SEO location seeding...\n");

  try {
    // 1. Seed states
    await seedStates();
    console.log("");

    // 2. Seed national parks
    await seedNationalParks();
    console.log("");

    // 3. Associate campgrounds with states
    await associateCampgroundsWithStates();
    console.log("");

    // 4. Associate campgrounds with attractions
    await associateCampgroundsWithAttractions();
    console.log("");

    // 5. Update stats
    await updateLocationStats();
    await updateAttractionStats();
    console.log("");

    console.log("SEO location seeding complete!");
  } catch (error) {
    console.error("Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
