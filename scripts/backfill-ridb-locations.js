#!/usr/bin/env node
/**
 * Backfill missing state/city data for RIDB campgrounds using reverse geocoding
 * Uses Nominatim (OpenStreetMap) - free, no API key required
 * Rate limited to 1 request per second per Nominatim usage policy
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// US state abbreviation mapping
const STATE_ABBREVS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en-US,en',
          'User-Agent': 'CampEveryday/1.0 (contact@campeveryday.com)'
        }
      }
    );

    if (!response.ok) {
      console.error(`Geocoding failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const address = data.address || {};

    // Extract state code from ISO3166-2-lvl4 or state name
    let stateCode = null;
    if (address['ISO3166-2-lvl4']) {
      stateCode = address['ISO3166-2-lvl4'].split('-')[1];
    } else if (address.state) {
      stateCode = STATE_ABBREVS[address.state] || null;
    }

    const city = address.city || address.town || address.village || address.county || null;
    const country = address.country_code?.toUpperCase() || null;

    return { state: stateCode, city, country };
  } catch (error) {
    console.error(`Geocoding error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("Fetching campgrounds needing location backfill...");

  const campgrounds = await prisma.campground.findMany({
    where: {
      isExternal: true,
      latitude: { not: null },
      OR: [
        { state: null },
        { state: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      city: true,
      state: true
    }
  });

  console.log(`Found ${campgrounds.length} campgrounds to backfill\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const cg = campgrounds[i];
    console.log(`[${i + 1}/${campgrounds.length}] ${cg.name}`);

    if (!cg.latitude || !cg.longitude) {
      console.log(`  Skipping - no coordinates`);
      skipped++;
      continue;
    }

    const location = await reverseGeocode(cg.latitude, cg.longitude);

    if (location && location.state) {
      await prisma.campground.update({
        where: { id: cg.id },
        data: {
          state: location.state,
          city: location.city || cg.city,
          country: location.country || 'US'
        }
      });
      console.log(`  Updated: ${location.city || 'N/A'}, ${location.state}`);
      updated++;
    } else {
      console.log(`  Failed to geocode`);
      failed++;
    }

    // Rate limit: 1 request per second (Nominatim policy)
    await sleep(1100);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  await prisma.$disconnect();
}

main().catch(console.error);
