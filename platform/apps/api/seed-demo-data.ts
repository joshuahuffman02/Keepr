import { Prisma, PrismaClient, ReservationStatus, SiteType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

type SeedSite = Prisma.SiteCreateManyInput & { id: string; siteType: SiteType };
type SeedGuest = Prisma.GuestCreateManyInput & { id: string };
type SeedReservation = Prisma.ReservationCreateManyInput & {
  id: string;
  guestId: string;
  departureDate: Date;
  status: ReservationStatus;
};

const CAMPGROUND_ID = "cmj3seh4m000b0fy3mhotssri";

// Helper to generate random ID
const cuid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

// Random date helper
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Random item from array
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// US States with weights for realistic distribution
const STATES = [
  { state: "TX", weight: 15 },
  { state: "CA", weight: 12 },
  { state: "FL", weight: 10 },
  { state: "CO", weight: 8 },
  { state: "AZ", weight: 7 },
  { state: "NM", weight: 6 },
  { state: "OK", weight: 5 },
  { state: "UT", weight: 5 },
  { state: "WA", weight: 4 },
  { state: "OR", weight: 4 },
  { state: "NV", weight: 4 },
  { state: "ID", weight: 3 },
  { state: "MT", weight: 3 },
  { state: "WY", weight: 3 },
  { state: "KS", weight: 2 },
  { state: "NE", weight: 2 },
  { state: "SD", weight: 2 },
  { state: "ND", weight: 1 },
  { state: "MN", weight: 2 },
  { state: "IA", weight: 2 },
];

const weightedRandomState = () => {
  const total = STATES.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * total;
  for (const s of STATES) {
    rand -= s.weight;
    if (rand <= 0) return s.state;
  }
  return "TX";
};

const FIRST_NAMES = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Barbara",
  "David",
  "Elizabeth",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Charles",
  "Karen",
  "Christopher",
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
  "Kimberly",
  "Paul",
  "Emily",
  "Andrew",
  "Donna",
  "Joshua",
  "Michelle",
];

const LAST_NAMES = [
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

const CITIES_BY_STATE: Record<string, string[]> = {
  TX: ["Austin", "Houston", "Dallas", "San Antonio", "Fort Worth"],
  CA: ["Los Angeles", "San Diego", "San Francisco", "Sacramento", "Fresno"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "Naples"],
  CO: ["Denver", "Colorado Springs", "Boulder", "Fort Collins", "Pueblo"],
  AZ: ["Phoenix", "Tucson", "Scottsdale", "Mesa", "Flagstaff"],
  NM: ["Albuquerque", "Santa Fe", "Las Cruces", "Roswell", "Taos"],
  OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond"],
  UT: ["Salt Lake City", "Provo", "St. George", "Ogden", "Moab"],
  WA: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Olympia"],
  OR: ["Portland", "Eugene", "Salem", "Bend", "Medford"],
  NV: ["Las Vegas", "Reno", "Henderson", "Carson City", "Sparks"],
  ID: ["Boise", "Meridian", "Idaho Falls", "Pocatello", "Twin Falls"],
  MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Helena"],
  WY: ["Cheyenne", "Casper", "Laramie", "Jackson", "Rock Springs"],
  KS: ["Wichita", "Overland Park", "Kansas City", "Topeka", "Olathe"],
  NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  MN: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
};

const RIG_TYPES = [
  { type: "Class A", length: [30, 45] },
  { type: "Class B", length: [19, 24] },
  { type: "Class C", length: [20, 33] },
  { type: "Fifth Wheel", length: [25, 42] },
  { type: "Travel Trailer", length: [15, 35] },
  { type: "Pop-up", length: [10, 16] },
  { type: "Van", length: [18, 24] },
  { type: "Truck Camper", length: [8, 12] },
];

const SITE_AMENITIES = {
  rv: [
    "50 amp",
    "30 amp",
    "Water hookup",
    "Sewer hookup",
    "WiFi",
    "Cable TV",
    "Fire pit",
    "Picnic table",
  ],
  tent: ["Fire pit", "Picnic table", "Near restrooms", "Shade trees", "Lantern hook"],
  cabin: ["AC", "Heat", "Kitchenette", "Private bathroom", "Linens", "WiFi", "Porch swing"],
  glamping: [
    "Queen bed",
    "AC",
    "Mini fridge",
    "Private deck",
    "Outdoor shower",
    "Fire pit",
    "WiFi",
  ],
};

async function seedSites() {
  console.log("Seeding sites...");

  const sites: SeedSite[] = [
    // RV Sites (30 sites)
    ...Array.from({ length: 30 }, (_, i) => ({
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      name: `RV Site ${i + 1}`,
      siteNumber: `RV${String(i + 1).padStart(2, "0")}`,
      siteType: "rv",
      maxOccupancy: 6,
      rigMaxLength: 45,
      pullThrough: i < 15,
      hookupsPower: true,
      powerAmps: i < 20 ? 50 : 30,
      hookupsWater: true,
      hookupsSewer: i < 25,
      petFriendly: true,
      accessible: i < 3,
      amenityTags: SITE_AMENITIES.rv.slice(0, 4 + Math.floor(Math.random() * 4)),
      isActive: true,
      status: "available",
    })),
    // Tent Sites (15 sites)
    ...Array.from({ length: 15 }, (_, i) => ({
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      name: `Tent Site ${i + 1}`,
      siteNumber: `T${String(i + 1).padStart(2, "0")}`,
      siteType: "tent",
      maxOccupancy: 4,
      petFriendly: true,
      accessible: i === 0,
      amenityTags: SITE_AMENITIES.tent.slice(0, 2 + Math.floor(Math.random() * 3)),
      isActive: true,
      status: "available",
    })),
    // Cabins (8 cabins)
    ...Array.from({ length: 8 }, (_, i) => ({
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      name: `Cabin ${i + 1}`,
      siteNumber: `C${String(i + 1).padStart(2, "0")}`,
      siteType: "cabin",
      maxOccupancy: i < 4 ? 4 : 6,
      petFriendly: i < 4,
      accessible: i === 0,
      amenityTags: SITE_AMENITIES.cabin.slice(0, 4 + Math.floor(Math.random() * 3)),
      isActive: true,
      status: "available",
    })),
    // Glamping (5 sites)
    ...Array.from({ length: 5 }, (_, i) => ({
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      name: `Safari Tent ${i + 1}`,
      siteNumber: `G${String(i + 1).padStart(2, "0")}`,
      siteType: "glamping",
      maxOccupancy: 4,
      petFriendly: false,
      accessible: i === 0,
      amenityTags: SITE_AMENITIES.glamping.slice(0, 5 + Math.floor(Math.random() * 2)),
      isActive: true,
      status: "available",
    })),
  ];

  await prisma.site.createMany({ data: sites });
  console.log(`Created ${sites.length} sites`);
  return sites;
}

async function seedGuests(count: number) {
  console.log(`Seeding ${count} guests...`);

  const guests: SeedGuest[] = Array.from({ length: count }, () => {
    const state = weightedRandomState();
    const cities = CITIES_BY_STATE[state] || ["Unknown City"];
    const rigInfo = Math.random() > 0.3 ? randomItem(RIG_TYPES) : null;

    return {
      id: cuid(),
      primaryFirstName: randomItem(FIRST_NAMES),
      primaryLastName: randomItem(LAST_NAMES),
      email: `guest${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
      phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
      city: randomItem(cities),
      state,
      country: "US",
      postalCode: String(10000 + Math.floor(Math.random() * 89999)),
      rigType: rigInfo?.type || null,
      rigLength: rigInfo
        ? Math.floor(rigInfo.length[0] + Math.random() * (rigInfo.length[1] - rigInfo.length[0]))
        : null,
      marketingOptIn: Math.random() > 0.4,
      repeatStays: Math.floor(Math.random() * 5),
      vip: Math.random() > 0.9,
    };
  });

  await prisma.guest.createMany({ data: guests });
  console.log(`Created ${guests.length} guests`);
  return guests;
}

async function seedReservations(sites: SeedSite[], guests: SeedGuest[]) {
  console.log("Seeding reservations...");

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const reservations: SeedReservation[] = [];

  // Generate reservations spread over 15 months (past year + 3 months future)
  for (let i = 0; i < 450; i++) {
    const site = randomItem(sites);
    const guest = randomItem(guests);

    // Arrival date weighted toward summer months
    let arrivalDate: Date;
    const monthWeight = Math.random();
    if (monthWeight < 0.5) {
      // 50% chance of May-September
      const summerStart = new Date(oneYearAgo);
      summerStart.setMonth(4); // May
      const summerEnd = new Date(oneYearAgo);
      summerEnd.setMonth(8); // September
      arrivalDate = randomDate(summerStart, threeMonthsFromNow);
      // Adjust to be in summer if random
      const month = arrivalDate.getMonth();
      if (month < 4 || month > 8) {
        arrivalDate.setMonth(4 + Math.floor(Math.random() * 5));
      }
    } else {
      arrivalDate = randomDate(oneYearAgo, threeMonthsFromNow);
    }

    // Length of stay
    let nights: number;
    const stayRand = Math.random();
    if (stayRand < 0.4)
      nights = 2 + Math.floor(Math.random() * 3); // 2-4 nights (40%)
    else if (stayRand < 0.7)
      nights = 5 + Math.floor(Math.random() * 3); // 5-7 nights (30%)
    else if (stayRand < 0.9)
      nights = 7 + Math.floor(Math.random() * 7); // 7-14 nights (20%)
    else nights = 14 + Math.floor(Math.random() * 16); // 14-30 nights (10%)

    const departureDate = new Date(arrivalDate);
    departureDate.setDate(departureDate.getDate() + nights);

    // Determine status based on dates
    let status: ReservationStatus;
    if (departureDate < now) {
      status = Math.random() > 0.08 ? "checked_out" : "cancelled";
    } else if (arrivalDate < now && departureDate > now) {
      status = "checked_in";
    } else {
      status = Math.random() > 0.05 ? "confirmed" : "cancelled";
    }

    // Pricing based on site type
    let nightlyRate: number;
    switch (site.siteType) {
      case "rv":
        nightlyRate = 45 + Math.floor(Math.random() * 25);
        break;
      case "tent":
        nightlyRate = 25 + Math.floor(Math.random() * 15);
        break;
      case "cabin":
        nightlyRate = 95 + Math.floor(Math.random() * 55);
        break;
      case "glamping":
        nightlyRate = 120 + Math.floor(Math.random() * 60);
        break;
      default:
        nightlyRate = 50;
    }

    const baseSubtotal = nightlyRate * nights * 100; // cents
    const taxRate = 0.08 + Math.random() * 0.04; // 8-12%
    const taxesAmount = Math.round(baseSubtotal * taxRate);
    const feesAmount = Math.round(baseSubtotal * 0.05); // 5% fees
    const totalAmount = baseSubtotal + taxesAmount + feesAmount;

    const paidAmount =
      status === "cancelled"
        ? 0
        : status === "checked_out"
          ? totalAmount
          : Math.round(totalAmount * (0.5 + Math.random() * 0.5));

    // Lead time (days between booking and arrival)
    const leadTimeDays = Math.floor(Math.random() * 60) + 1;
    const bookedAt = new Date(arrivalDate);
    bookedAt.setDate(bookedAt.getDate() - leadTimeDays);

    // Rig info for RV sites
    const rigType = site.siteType === "rv" && guest.rigType ? guest.rigType : null;
    const rigLength = site.siteType === "rv" && guest.rigLength ? guest.rigLength : null;

    // Source
    const sources = ["website", "phone", "walk-in", "repeat", "referral", "ota"];
    const sourceWeights = [0.5, 0.15, 0.1, 0.15, 0.05, 0.05];
    let sourceRand = Math.random();
    let source = "website";
    for (let j = 0; j < sources.length; j++) {
      sourceRand -= sourceWeights[j];
      if (sourceRand <= 0) {
        source = sources[j];
        break;
      }
    }

    reservations.push({
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      siteId: site.id,
      guestId: guest.id,
      arrivalDate,
      departureDate,
      adults: 1 + Math.floor(Math.random() * 3),
      children: Math.floor(Math.random() * 3),
      status,
      totalAmount,
      paidAmount,
      balanceAmount: totalAmount - paidAmount,
      baseSubtotal,
      taxesAmount,
      feesAmount,
      paymentStatus: paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
      source,
      rigType,
      rigLength,
      leadTimeDays,
      bookedAt,
      stayType: nights >= 28 ? "monthly" : nights >= 7 ? "weekly" : "standard",
      checkInAt: status === "checked_in" || status === "checked_out" ? arrivalDate : null,
      checkOutAt: status === "checked_out" ? departureDate : null,
      createdAt: bookedAt,
    });
  }

  // Batch insert
  for (let i = 0; i < reservations.length; i += 50) {
    await prisma.reservation.createMany({ data: reservations.slice(i, i + 50) });
  }

  console.log(`Created ${reservations.length} reservations`);
  return reservations;
}

async function seedNps(reservations: SeedReservation[]) {
  console.log("Seeding NPS survey and responses...");

  // Create NPS Survey
  const surveyId = cuid();
  await prisma.npsSurvey.create({
    data: {
      id: surveyId,
      campgroundId: CAMPGROUND_ID,
      name: "Post-Stay Survey",
      question: "How likely are you to recommend us to a friend or colleague?",
      status: "active",
      channels: ["inapp", "email"],
    },
  });

  // Get checked_out reservations for NPS responses
  const completedReservations = reservations.filter((r) => r.status === "checked_out");
  const respondingReservations = completedReservations.filter(() => Math.random() > 0.6); // 40% response rate

  const responses = respondingReservations.map((res) => {
    // Score distribution: 60% promoters, 25% passives, 15% detractors
    let score: number;
    const rand = Math.random();
    if (rand < 0.15)
      score = Math.floor(Math.random() * 7); // 0-6 detractors
    else if (rand < 0.4)
      score = 7 + Math.floor(Math.random() * 2); // 7-8 passives
    else score = 9 + Math.floor(Math.random() * 2); // 9-10 promoters

    const comments: Record<number, string[]> = {
      10: [
        "Amazing stay! Will definitely come back.",
        "Best campground we've ever stayed at!",
        "Perfect in every way.",
      ],
      9: ["Great experience overall.", "Really enjoyed our stay.", "Would highly recommend."],
      8: [
        "Nice campground, good facilities.",
        "Pleasant stay with minor issues.",
        "Good value for money.",
      ],
      7: ["Decent stay, some room for improvement.", "Okay experience.", "Met our basic needs."],
      6: ["Below expectations.", "Some issues with cleanliness.", "Staff could be more helpful."],
      5: ["Mediocre experience.", "Wouldn't stay again.", "Too noisy at night."],
      4: ["Disappointed with our stay.", "Facilities need updating.", "Not worth the price."],
      3: ["Poor experience overall.", "Multiple issues during stay.", "Would not recommend."],
      2: ["Very disappointed.", "Had major problems.", "Rude staff."],
      1: ["Terrible experience.", "Will never return.", "Worst campground ever."],
      0: ["Absolutely awful.", "Complete disaster.", "Avoid at all costs."],
    };

    const possibleComments = comments[score] || comments[5];
    const comment = Math.random() > 0.3 ? randomItem(possibleComments) : null;

    return {
      id: cuid(),
      surveyId,
      campgroundId: CAMPGROUND_ID,
      guestId: res.guestId,
      reservationId: res.id,
      score,
      comment,
      sentiment: score >= 9 ? "positive" : score >= 7 ? "neutral" : "negative",
      createdAt: new Date(res.departureDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000),
    };
  });

  await prisma.npsResponse.createMany({ data: responses });
  console.log(`Created NPS survey and ${responses.length} responses`);
  return responses;
}

async function seedReviews(reservations: SeedReservation[]) {
  console.log("Seeding reviews...");

  const completedReservations = reservations.filter((r) => r.status === "checked_out");
  const reviewingReservations = completedReservations.filter(() => Math.random() > 0.75); // 25% review rate

  const reviewTitles: Record<number, string[]> = {
    5: [
      "Perfect getaway!",
      "Exceeded expectations",
      "Will be back!",
      "Hidden gem",
      "Wonderful experience",
    ],
    4: ["Great stay", "Really enjoyed it", "Nice campground", "Good experience", "Solid choice"],
    3: [
      "Decent campground",
      "Average stay",
      "Met expectations",
      "Okay experience",
      "Nothing special",
    ],
    2: ["Disappointing", "Below average", "Not impressed", "Needs improvement", "Won't return"],
    1: ["Terrible", "Awful experience", "Stay away", "Complete disaster", "Worst ever"],
  };

  const reviewBodies: Record<number, string[]> = {
    5: [
      "We had an amazing time at this campground. The facilities were spotless, the staff was incredibly friendly, and the location was beautiful. We can't wait to come back!",
      "This was our first time staying here and we were blown away. The sites are well-maintained, there's plenty of shade, and the amenities are top-notch.",
      "Absolutely loved our stay! The campground exceeded all our expectations. Clean bathrooms, friendly staff, and beautiful surroundings.",
    ],
    4: [
      "Really enjoyed our stay. The campground is well-maintained and the staff is helpful. A few minor improvements could make it perfect.",
      "Good campground with nice amenities. We had a pleasant stay and would consider returning. The sites were a bit close together but overall positive experience.",
      "Solid campground choice. Clean facilities, decent size sites, and fair pricing. Would recommend to friends.",
    ],
    3: [
      "Average campground that met our basic needs. Nothing spectacular but nothing terrible either. Fine for a night or two.",
      "Decent place to stay. Some areas could use maintenance but overall acceptable. Might try somewhere else next time.",
      "It was okay. The location is convenient but the facilities are showing their age. Staff was friendly though.",
    ],
    2: [
      "Below our expectations. The bathrooms weren't clean when we arrived and noise from neighbors was an issue all night.",
      "Disappointed with our stay. The photos online don't reflect the current state of the campground. Needs updating.",
      "Not impressed. Had issues with our site assignment and the staff wasn't very helpful in resolving them.",
    ],
    1: [
      "Terrible experience. Facilities were dirty, staff was rude, and the sites were way too small. Will not return.",
      "Worst campground we've ever stayed at. Multiple issues that went unaddressed. Save your money.",
      "Complete disaster from check-in to check-out. Nothing worked as advertised. Avoid this place.",
    ],
  };

  const reviews = reviewingReservations.map((res) => {
    // Rating distribution
    let rating: number;
    const rand = Math.random();
    if (rand < 0.5) rating = 5;
    else if (rand < 0.75) rating = 4;
    else if (rand < 0.9) rating = 3;
    else if (rand < 0.95) rating = 2;
    else rating = 1;

    const titles = reviewTitles[rating];
    const bodies = reviewBodies[rating];

    return {
      id: cuid(),
      campgroundId: CAMPGROUND_ID,
      guestId: res.guestId,
      reservationId: res.id,
      rating,
      title: randomItem(titles),
      body: randomItem(bodies),
      source: "onsite",
      status: "approved",
      exposure: "public",
      createdAt: new Date(res.departureDate.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
    };
  });

  await prisma.review.createMany({ data: reviews });
  console.log(`Created ${reviews.length} reviews`);
  return reviews;
}

async function main() {
  console.log("Starting demo data seed...\n");

  try {
    // Check if campground exists
    const campground = await prisma.campground.findUnique({
      where: { id: CAMPGROUND_ID },
    });

    if (!campground) {
      console.error(`Campground ${CAMPGROUND_ID} not found!`);
      process.exit(1);
    }

    console.log(`Seeding data for: ${campground.name}\n`);

    // Clear existing data
    console.log("Clearing existing demo data...");
    await prisma.review.deleteMany({ where: { campgroundId: CAMPGROUND_ID } });
    await prisma.npsResponse.deleteMany({ where: { campgroundId: CAMPGROUND_ID } });
    await prisma.npsSurvey.deleteMany({ where: { campgroundId: CAMPGROUND_ID } });
    await prisma.reservation.deleteMany({ where: { campgroundId: CAMPGROUND_ID } });
    await prisma.site.deleteMany({ where: { campgroundId: CAMPGROUND_ID } });
    // Note: Not deleting guests as they might be shared

    // Seed data
    const sites = await seedSites();
    const guests = await seedGuests(200);
    const reservations = await seedReservations(sites, guests);
    await seedNps(reservations);
    await seedReviews(reservations);

    console.log("\nDemo data seeded successfully!");
    console.log("\nSummary:");
    console.log(`  Sites: ${sites.length}`);
    console.log(`  Guests: ${guests.length}`);
    console.log(`  Reservations: ${reservations.length}`);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
