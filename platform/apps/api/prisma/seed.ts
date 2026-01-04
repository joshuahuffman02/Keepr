import {
  PlatformRole,
  Prisma,
  PrismaClient,
  ReservationStatus,
  SiteType,
  MaintenanceStatus,
  MaintenancePriority,
  UserRole,
  SocialPlatform,
  SocialPostStatus,
  SocialContentCategory,
  SocialTemplateStyle,
  SocialAssetType,
  SocialSuggestionStatus,
  SocialSuggestionType,
  SocialAlertCategory,
  RateType,
  PaymentSchedule,
  PricingStructure,
  ChargeStatus,
  GamificationEventCategory,
  StayType
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const SEASON_WINDOW = { startMonth: 3, startDay: 15, endMonth: 9, endDay: 30 }; // Apr 15 - Oct 30-ish
const seasonForYear = (year: number) => ({
  start: new Date(Date.UTC(year, SEASON_WINDOW.startMonth, SEASON_WINDOW.startDay, 12, 0, 0)),
  end: new Date(Date.UTC(year, SEASON_WINDOW.endMonth, SEASON_WINDOW.endDay, 12, 0, 0))
});

// GL Code constants for accounting
const GL_CODES = {
  SITE_REVENUE: "4100",
  FEES_REVENUE: "4200",
  TAX_PAYABLE: "2100",
  ACCOUNTS_RECEIVABLE: "1200",
  CASH: "1000",
  DISCOUNTS: "4900"
};

const seededCampgrounds = [
  {
    name: "Keepr – Riverbend",
    slug: "camp-everyday-riverbend",
    city: "Winona",
    state: "MN",
    timezone: "America/Chicago",
    vibe: "river",
    size: "medium",
    guestOffset: 0
  },
  {
    name: "Keepr – Mountain Base",
    slug: "camp-everyday-mtn-base",
    city: "Salida",
    state: "CO",
    timezone: "America/Denver",
    vibe: "mountain",
    size: "medium",
    guestOffset: 240
  },
  {
    name: "Sunset Sands RV Resort",
    slug: "sunset-sands-resort",
    city: "Moab",
    state: "UT",
    timezone: "America/Denver",
    vibe: "desert_resort",
    size: "resort",
    guestOffset: 480
  },
  {
    name: "Blueberry Hill Camp & Cabin",
    slug: "blueberry-hill-camp",
    city: "Asheville",
    state: "NC",
    timezone: "America/New_York",
    vibe: "boutique",
    size: "small",
    guestOffset: 720
  },
  {
    name: "Redwood Ridge Hideout",
    slug: "redwood-ridge-hideout",
    city: "Eureka",
    state: "CA",
    timezone: "America/Los_Angeles",
    vibe: "redwoods",
    size: "mom_pop",
    guestOffset: 960
  }
];

async function resetCampgroundData(campgroundId: string) {
  // Scoped cleanup so reruns do not collide with uniques for these seed campgrounds
  const membershipTypes = await prisma.membershipType.findMany({ where: { campgroundId } });
  const membershipTypeIds = membershipTypes.map((m) => m.id);

  if (membershipTypeIds.length) {
    await prisma.guestMembership.deleteMany({ where: { membershipTypeId: { in: membershipTypeIds } } });
  }

  await prisma.$transaction([
    prisma.dispute.deleteMany({ where: { campgroundId } }),
    prisma.reservation.deleteMany({ where: { campgroundId } }),
    prisma.storeOrder.deleteMany({ where: { campgroundId } }),
    prisma.activity.deleteMany({ where: { campgroundId } }),
    prisma.event.deleteMany({ where: { campgroundId } }),
    prisma.maintenanceTicket.deleteMany({ where: { campgroundId } }),
    prisma.pricingRule.deleteMany({ where: { campgroundId } }),
    prisma.seasonalRate.deleteMany({ where: { campgroundId } }),
    prisma.waitlistEntry.deleteMany({ where: { campgroundId } }),
    prisma.promotion.deleteMany({ where: { campgroundId } }),
    prisma.siteHold.deleteMany({ where: { campgroundId } }),
    prisma.blackoutDate.deleteMany({ where: { campgroundId } }),
    prisma.productCategory.deleteMany({ where: { campgroundId } }),
    prisma.product.deleteMany({ where: { campgroundId } }),
    prisma.addOnService.deleteMany({ where: { campgroundId } }),
    prisma.membershipType.deleteMany({ where: { campgroundId } }),
    prisma.campgroundMembership.deleteMany({ where: { campgroundId } }),
    prisma.xpRule.deleteMany({ where: { campgroundId } }),
    prisma.xpBalance.deleteMany({ where: { campgroundId } }),
    prisma.xpEvent.deleteMany({ where: { campgroundId } }),
    prisma.site.deleteMany({ where: { campgroundId } }),
    prisma.siteClass.deleteMany({ where: { campgroundId } })
  ]);
}

// ============ USERS ============
async function seedUsers() {
  const password = await bcrypt.hash("password123", 12);

  const userDefs: Array<{ email: string; firstName: string; lastName: string; platformRole?: PlatformRole }> = [
    { email: "admin@keeprstay.com", firstName: "Admin", lastName: "User", platformRole: PlatformRole.platform_admin },
    { email: "josh@keeprstay.com", firstName: "Josh", lastName: "Owner", platformRole: PlatformRole.platform_admin },
    { email: "manager@keeprstay.com", firstName: "Sarah", lastName: "Manager" },
    { email: "frontdesk@keeprstay.com", firstName: "Mike", lastName: "Reception" },
    { email: "maintenance@keeprstay.com", firstName: "Bob", lastName: "Fixit" },
    { email: "finance@keeprstay.com", firstName: "Priya", lastName: "Ledger" },
    { email: "marketing@keeprstay.com", firstName: "Lena", lastName: "Hype" },
    { email: "bucky@keeprstay.com", firstName: "Bucky", lastName: "Admin", platformRole: PlatformRole.platform_admin },
    { email: "allie@keeprstay.com", firstName: "Allie", lastName: "Admin", platformRole: PlatformRole.platform_admin },
    { email: "murf@keeprstay.com", firstName: "Murf", lastName: "Admin", platformRole: PlatformRole.platform_admin }
  ];

  const users = await Promise.all(
    userDefs.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          passwordHash: password,
          isActive: true,
          firstName: user.firstName,
          lastName: user.lastName,
          platformRole: user.platformRole ?? null
        },
        create: { ...user, passwordHash: password, isActive: true, platformRole: user.platformRole ?? null }
      })
    )
  );

  console.log(`  Created ${users.length} users (password: password123)`);
  return users;
}

// ============ SITE CLASSES ============
function buildSiteClasses(
  campgroundId: string,
  opts: {
    rateMultiplier?: number;
    addGlamping?: boolean;
  } = {}
) {
  const rate = (base: number) => Math.round(base * (opts.rateMultiplier ?? 1));

  return [
    {
      name: "Premium RV",
      description: "Full hookups, river-adjacent pads.",
      defaultRate: rate(9500),
      siteType: SiteType.rv,
      maxOccupancy: 8,
      rigMaxLength: 45,
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: true,
      minNights: 2,
      petFriendly: true,
      accessible: false,
      photos: [],
      policyVersion: "spring-2025",
      isActive: true,
      glCode: GL_CODES.SITE_REVENUE,
      campgroundId
    },
    {
      name: "Standard RV",
      description: "30A power and water, easy back-in.",
      defaultRate: rate(7500),
      siteType: SiteType.rv,
      maxOccupancy: 6,
      rigMaxLength: 38,
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: false,
      minNights: 1,
      petFriendly: true,
      accessible: false,
      photos: [],
      isActive: true,
      glCode: GL_CODES.SITE_REVENUE,
      campgroundId
    },
    {
      name: "Tent Meadow",
      description: "Shade trees, short walk to bathhouse.",
      defaultRate: rate(4500),
      siteType: SiteType.tent,
      maxOccupancy: 4,
      rigMaxLength: null,
      hookupsPower: false,
      hookupsWater: true,
      hookupsSewer: false,
      minNights: 1,
      petFriendly: true,
      accessible: false,
      photos: [],
      isActive: true,
      glCode: GL_CODES.SITE_REVENUE,
      campgroundId
    },
    {
      name: "Cabins",
      description: "Climate controlled, linens included.",
      defaultRate: rate(14500),
      siteType: SiteType.cabin,
      maxOccupancy: 6,
      rigMaxLength: null,
      hookupsPower: true,
      hookupsWater: true,
      hookupsSewer: true,
      minNights: 2,
      petFriendly: false,
      accessible: true,
      photos: [],
      isActive: true,
      glCode: GL_CODES.SITE_REVENUE,
      campgroundId
    },
    {
      name: "Group Field",
      description: "Open field for scouts and reunions.",
      defaultRate: rate(22500),
      siteType: SiteType.group,
      maxOccupancy: 30,
      rigMaxLength: null,
      hookupsPower: false,
      hookupsWater: false,
      hookupsSewer: false,
      minNights: 2,
      petFriendly: true,
      accessible: false,
      photos: [],
      isActive: true,
      glCode: GL_CODES.SITE_REVENUE,
      campgroundId
    },
    ...(opts.addGlamping
      ? [
        {
          name: "Glamping Safari",
          description: "Canvas tents with decks and AC.",
          defaultRate: rate(17500),
          siteType: SiteType.glamping,
          maxOccupancy: 4,
          rigMaxLength: null,
          hookupsPower: true,
          hookupsWater: true,
          hookupsSewer: false,
          minNights: 2,
          petFriendly: false,
          accessible: true,
          photos: [],
          policyVersion: "glamping-1",
          isActive: true,
          glCode: GL_CODES.SITE_REVENUE,
          campgroundId
        }
      ]
      : [])
  ];
}

// ============ SITES ============
function buildSites(
  campgroundId: string,
  siteClasses: { id: string; siteType: SiteType; name: string }[],
  mix: Partial<{
    premium: number;
    standard: number;
    tent: number;
    cabin: number;
    group: number;
    glamping: number;
  }> = {}
) {
  const sites: Prisma.SiteUncheckedCreateInput[] = [];

  const addSites = (clsName: string, count: number, prefix: string, startNum: number, opts?: Partial<Prisma.SiteUncheckedCreateInput>) => {
    const cls = siteClasses.find((c) => c.name === clsName);
    if (!cls) return;
    for (let i = 0; i < count; i++) {
      const siteNumber = `${prefix}${startNum + i}`;
      sites.push({
        campgroundId,
        siteClassId: cls.id,
        name: siteNumber,
        siteNumber,
        siteType: cls.siteType,
        maxOccupancy: cls.siteType === SiteType.group ? 30 : cls.siteType === SiteType.cabin ? 6 : cls.siteType === SiteType.tent ? 4 : 6,
        rigMaxLength: cls.siteType === SiteType.rv ? randomBetween(30, 45) : null,
        hookupsPower: cls.siteType !== SiteType.tent,
        hookupsWater: cls.siteType !== SiteType.tent,
        hookupsSewer: cls.siteType === SiteType.rv && clsName === "Premium RV",
        powerAmps: cls.siteType === SiteType.rv ? 50 : null,
        petFriendly: cls.siteType !== SiteType.cabin,
        accessible: Boolean(opts?.accessible),
        minNights: opts?.minNights ?? null,
        maxNights: opts?.maxNights ?? null,
        photos: [],
        description: opts?.description ?? null,
        tags: [],
        isActive: true,
        status: "available"
      });
    }
  };

  addSites("Premium RV", mix.premium ?? 15, "P", 1, { minNights: 2, description: "Premium pull-through" });
  addSites("Standard RV", mix.standard ?? 20, "R", 101);
  addSites("Tent Meadow", mix.tent ?? 12, "T", 201);
  addSites("Cabins", mix.cabin ?? 8, "C", 301, { accessible: true, minNights: 2 });
  addSites("Group Field", mix.group ?? 4, "G", 401, { minNights: 2, maxNights: 7 });
  if (mix.glamping && mix.glamping > 0) {
    addSites("Glamping Safari", mix.glamping, "S", 501, { minNights: 2, maxNights: 10 });
  }

  return sites;
}

// ============ GUESTS ============
function generateGuests(count: number, offset: number = 0, emailSuffix: string) {
  const firstNames = ["Riley", "Jamie", "Alex", "Taylor", "Jordan", "Casey", "Morgan", "Charlie", "Hayden", "Avery", "John", "Jane", "Michael", "Emily", "David", "Sarah", "Chris", "Lisa", "Matt", "Rachel"];
  const lastNames = ["Smith", "Garcia", "Nguyen", "Johnson", "Brown", "Lee", "Patel", "Kim", "Lopez", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson"];
  const guests = [];
  for (let i = 0; i < count; i++) {
    const globalIndex = i + offset;
    const first = pick(firstNames);
    const last = pick(lastNames);
    const suffix = emailSuffix ? `+${emailSuffix}` : "";
    guests.push({
      primaryFirstName: first,
      primaryLastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${globalIndex}${suffix}@example.com`,
      phone: `555-${(1000 + (globalIndex % 9000)).toString().padStart(4, "0")}`,
      address1: `${randomBetween(100, 9999)} ${pick(["Main St", "Oak Ave", "Pine Rd", "Lake Dr", "River Ln"])}`,
      city: pick(["Minneapolis", "Denver", "Austin", "Portland", "Seattle", "Chicago"]),
      state: pick(["MN", "CO", "TX", "OR", "WA", "IL"]),
      postalCode: `${randomBetween(10000, 99999)}`,
      country: "USA",
      notes: i % 7 === 0 ? "Prefers shade" : i % 11 === 0 ? "Returning guest - VIP" : undefined,
      marketingOptIn: i % 3 === 0,
      vip: i % 17 === 0,
      tags: i % 10 === 0 ? ["seasonal"] : i % 6 === 0 ? ["vip"] : [],
      rigType: i % 2 === 0 ? pick(["Class A", "Fifth Wheel", "Travel Trailer", "Pop-up"]) : null,
      rigLength: i % 2 === 0 ? randomBetween(20, 42) : null,
      repeatStays: randomBetween(0, 5)
    });
  }
  return guests;
}

// ============ PRICING RULES ============
function buildPricingRules(campgroundId: string, siteClasses: { id: string; name: string }[]) {
  const rules: Prisma.PricingRuleUncheckedCreateInput[] = [];

  // Weekend surcharge (Fri/Sat) for all classes
  siteClasses.forEach((cls) => {
    // Friday surcharge
    rules.push({
      campgroundId,
      siteClassId: cls.id,
      label: "Friday Premium",
      ruleType: "dow",
      dayOfWeek: 5,
      percentAdjust: 0.15,
      isActive: true
    });
    // Saturday surcharge
    rules.push({
      campgroundId,
      siteClassId: cls.id,
      label: "Saturday Premium",
      ruleType: "dow",
      dayOfWeek: 6,
      percentAdjust: 0.20,
      isActive: true
    });
  });

  // Holiday season surcharge
  rules.push({
    campgroundId,
    siteClassId: null,
    label: "Memorial Day Week",
    ruleType: "seasonal",
    startDate: new Date("2025-05-23"),
    endDate: new Date("2025-05-26"),
    percentAdjust: 0.25,
    isActive: true
  });

  rules.push({
    campgroundId,
    siteClassId: null,
    label: "July 4th Week",
    ruleType: "seasonal",
    startDate: new Date("2025-07-01"),
    endDate: new Date("2025-07-07"),
    percentAdjust: 0.30,
    isActive: true
  });

  rules.push({
    campgroundId,
    siteClassId: null,
    label: "Labor Day Week",
    ruleType: "seasonal",
    startDate: new Date("2025-08-29"),
    endDate: new Date("2025-09-01"),
    percentAdjust: 0.25,
    isActive: true
  });

  return rules;
}

// ============ SEASONAL & LONG-STAY RATES ============
function buildSeasonalRates(campgroundId: string, siteClasses: { id: string; name: string; siteType: SiteType }[]) {
  const premium = siteClasses.find((c) => c.name === "Premium RV");
  const cabins = siteClasses.find((c) => c.siteType === SiteType.cabin);
  const standard = siteClasses.find((c) => c.name === "Standard RV");

  return [
    {
      campgroundId,
      siteClassId: premium?.id ?? null,
      name: "Snowbird Monthly",
      rateType: RateType.monthly,
      amount: 120000,
      minNights: 25,
      startDate: new Date("2025-11-01"),
      endDate: new Date("2026-03-15"),
      paymentSchedule: PaymentSchedule.monthly,
      pricingStructure: PricingStructure.flat_month,
      offseasonInterval: 1,
      offseasonAmount: 120000,
      prorateExcess: true,
      isActive: true
    },
    {
      campgroundId,
      siteClassId: standard?.id ?? null,
      name: "Weekly RV Saver",
      rateType: RateType.weekly,
      amount: 42000,
      minNights: 7,
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-10-31"),
      paymentSchedule: PaymentSchedule.as_you_stay,
      pricingStructure: PricingStructure.flat_week,
      prorateExcess: true,
      isActive: true
    },
    {
      campgroundId,
      siteClassId: cabins?.id ?? null,
      name: "Cabin Monthly Retreat",
      rateType: RateType.monthly,
      amount: 185000,
      minNights: 25,
      startDate: new Date("2025-12-01"),
      endDate: new Date("2026-03-01"),
      paymentSchedule: PaymentSchedule.monthly,
      pricingStructure: PricingStructure.flat_month,
      prorateExcess: true,
      isActive: true
    }
  ];
}

// ============ MAINTENANCE TICKETS ============
function buildMaintenanceTickets(campgroundId: string, sites: { id: string; name: string }[]) {
  const titles = [
    "Water leak at hookup",
    "Electrical outlet not working",
    "Picnic table damaged",
    "Fire pit needs cleaning",
    "Tree branch overhanging",
    "Pothole in road",
    "Shower head broken",
    "Light fixture out",
    "Fence repair needed",
    "Trash can missing"
  ];

  const tickets: Prisma.MaintenanceTicketUncheckedCreateInput[] = [];

  // Create various maintenance tickets
  for (let i = 0; i < 25; i++) {
    const site = i < 15 ? pick(sites) : null;
    const statusPool = [MaintenanceStatus.open, MaintenanceStatus.open, MaintenanceStatus.in_progress, MaintenanceStatus.closed];
    const priorityPool = [MaintenancePriority.low, MaintenancePriority.medium, MaintenancePriority.medium, MaintenancePriority.high];

    const dueOffset = randomBetween(-5, 14);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueOffset);

    tickets.push({
      campgroundId,
      siteId: site?.id ?? null,
      title: pick(titles),
      description: i % 3 === 0 ? "Guest reported issue. Please address ASAP." : null,
      status: pick(statusPool),
      priority: pick(priorityPool),
      dueDate: dueDate
    });
  }

  return tickets;
}

// ============ EVENTS ============
function buildEvents(campgroundId: string, state: string, seasonStart: Date) {
  const events: Prisma.EventUncheckedCreateInput[] = [];

  // Sample events based on location
  const eventTemplates = state === "MN" ? [
    { title: "River Fishing Tournament", type: "activity" as const, description: "Catch the biggest walleye and win prizes!", location: "Fishing Dock", price: 2500, capacity: 50 },
    { title: "Sunset Kayak Tour", type: "activity" as const, description: "Guided kayak paddle along the river bluffs at sunset.", location: "Boat Ramp", price: 3500, capacity: 12 },
    { title: "Kids Nature Scavenger Hunt", type: "activity" as const, description: "Fun outdoor adventure for kids ages 5-12.", location: "Nature Trail", price: 0, capacity: 20 },
    { title: "Campfire Cookout Class", type: "workshop" as const, description: "Learn to make delicious campfire meals.", location: "Main Pavilion", price: 1500, capacity: 15 },
    { title: "Saturday Night Live Music", type: "entertainment" as const, description: "Local bluegrass band performs live.", location: "Amphitheater", price: 0, capacity: 100 },
    { title: "Memorial Day Weekend BBQ", type: "holiday" as const, description: "Annual kick-off to summer celebration with BBQ and games.", location: "Main Pavilion", price: 1000, capacity: 150 },
    { title: "4th of July Fireworks", type: "holiday" as const, description: "Watch fireworks over the river.", location: "Riverfront", price: 0, capacity: null },
    { title: "Weekly Potluck Dinner", type: "recurring" as const, description: "Bring a dish to share every Wednesday evening.", location: "Pavilion", price: 0, capacity: 40 },
  ] : [
    { title: "Mountain Sunrise Hike", type: "activity" as const, description: "Early morning hike to catch the sunrise over the peaks.", location: "Trailhead", price: 0, capacity: 15 },
    { title: "Guided Mountain Biking", type: "activity" as const, description: "Intermediate level trail ride with guide.", location: "Bike Shop", price: 4500, capacity: 8 },
    { title: "Whitewater Rafting Trip", type: "activity" as const, description: "Half-day rafting adventure on the Arkansas River.", location: "River Put-In", price: 7500, capacity: 10 },
    { title: "Wilderness Photography Workshop", type: "workshop" as const, description: "Learn to capture stunning mountain landscapes.", location: "Base Camp", price: 5000, capacity: 12 },
    { title: "Star Gazing Night", type: "entertainment" as const, description: "Telescope viewing with astronomy expert.", location: "Upper Meadow", price: 1000, capacity: 25 },
    { title: "4th of July Mountain Fest", type: "holiday" as const, description: "Live music, food trucks, and fireworks.", location: "Main Field", price: 0, capacity: 200 },
    { title: "Weekly Yoga in the Meadow", type: "recurring" as const, description: "Morning yoga class every Saturday.", location: "Meadow", price: 500, capacity: 20 },
  ];

  eventTemplates.forEach((template, index) => {
    // Create events spread throughout the season
    const dayOffset = index * 14 + randomBetween(0, 7);
    const startDate = new Date(seasonStart);
    startDate.setDate(startDate.getDate() + dayOffset);

    const isAllDay = template.type === "holiday";

    events.push({
      campgroundId,
      title: template.title,
      description: template.description,
      eventType: template.type,
      startDate,
      endDate: isAllDay ? startDate : null,
      startTime: isAllDay ? null : pick(["09:00", "10:00", "14:00", "18:00", "19:00"]),
      endTime: isAllDay ? null : pick(["11:00", "12:00", "16:00", "21:00", "22:00"]),
      isAllDay,
      isRecurring: template.type === "recurring",
      recurrenceRule: template.type === "recurring" ? "FREQ=WEEKLY" : null,
      location: template.location,
      capacity: template.capacity,
      priceCents: template.price,
      isGuestOnly: template.price === 0,
      isPublished: true,
      isCancelled: false
    });
  });

  return events;
}

// ============ RESERVATIONS WITH PAYMENTS & LEDGER ============
function randomReservationDatesForYear(year: number, stayType: StayType) {
  const { start, end } = seasonForYear(year);
  const startTs = start.getTime();
  const endTs = end.getTime();
  let nights: number;
  switch (stayType) {
    case StayType.weekly:
      nights = randomBetween(5, 10);
      break;
    case StayType.monthly:
      nights = randomBetween(25, 32);
      break;
    case StayType.seasonal:
      nights = randomBetween(50, 120);
      break;
    default:
      nights = randomBetween(1, 8);
  }
  const arrivalTs = randomBetween(startTs, endTs - (nights + 1) * 24 * 60 * 60 * 1000);
  const departureTs = arrivalTs + nights * 24 * 60 * 60 * 1000;
  return { arrivalDate: new Date(arrivalTs), departureDate: new Date(departureTs), nights };
}

async function seedSocialPlanner(campgroundId: string, seasonStart: Date) {
  console.log("  Seeding Social Media Planner demo data...");

  const templates = await prisma.$transaction([
    prisma.socialTemplate.create({
      data: {
        campgroundId,
        name: "Weekend promo",
        summary: "Countdown + CTA",
        category: SocialContentCategory.promo,
        style: SocialTemplateStyle.short,
        defaultCaption: "Weekends fill fast — book now and save your spot.",
        captionFillIns: "Add CTA + offer + scarcity",
        hashtagSet: ["#camping", "#weekendtrip", "#rvcamping"],
        bestTime: "Thu 7pm"
      }
    }),
    prisma.socialTemplate.create({
      data: {
        campgroundId,
        name: "Event hype",
        summary: "Teaser + schedule",
        category: SocialContentCategory.events,
        style: SocialTemplateStyle.carousel,
        defaultCaption: "Christmas in July is coming! Teaser + schedule drop.",
        hashtagSet: ["#campgroundevents", "#familyfun"],
        bestTime: "Tue 6pm"
      }
    }),
    prisma.socialTemplate.create({
      data: {
        campgroundId,
        name: "Staff spotlight",
        summary: "Photo + quote",
        category: SocialContentCategory.general,
        style: SocialTemplateStyle.story,
        defaultCaption: "Meet the crew that keeps stays awesome.",
        hashtagSet: ["#campstaff", "#peopleofcamp"],
        bestTime: "Thu 12pm"
      }
    })
  ]);

  const assets = await prisma.$transaction([
    prisma.socialContentAsset.create({
      data: {
        campgroundId,
        title: "Pool opening hero",
        type: SocialAssetType.photo,
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
        tags: ["pool", "summer", "hero"]
      }
    }),
    prisma.socialContentAsset.create({
      data: {
        campgroundId,
        title: "Cabin exterior golden hour",
        type: SocialAssetType.photo,
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
        tags: ["cabin", "sunset"]
      }
    }),
    prisma.socialContentAsset.create({
      data: {
        campgroundId,
        title: "Branded caption: fall colors",
        type: SocialAssetType.other,
        url: "Fall colors peak in 2 weeks — cabins and RV spots are going fast. Book now to catch the leaves!",
        tags: ["fall", "availability"]
      }
    })
  ]);

  const posts = await prisma.$transaction([
    prisma.socialPost.create({
      data: {
        campgroundId,
        title: "Pool opening weekend",
        platform: SocialPlatform.facebook,
        status: SocialPostStatus.scheduled,
        category: SocialContentCategory.amenities,
        scheduledFor: addDays(new Date(), 5),
        caption: "Pool opens Saturday! First cannonball wins a free s'mores kit.",
        hashtags: ["#poolday", "#campfun"],
        imagePrompt: "Families enjoying pool with pine trees",
        templateId: templates[0].id,
        assetUrls: [assets[0].url]
      }
    }),
    prisma.socialPost.create({
      data: {
        campgroundId,
        title: "Staff story: Sarah",
        platform: SocialPlatform.instagram,
        status: SocialPostStatus.draft,
        category: SocialContentCategory.general,
        caption: "Sarah keeps arrivals smooth and loves sunrise hikes.",
        hashtags: ["#campstaff", "#behindthescenes"],
        imagePrompt: "Portrait of smiling campground manager at desk",
        templateId: templates[2].id,
        ideaParkingLot: true
      }
    })
  ]);

  const suggestions = await prisma.$transaction([
    prisma.socialSuggestion.create({
      data: {
        campgroundId,
        type: SocialSuggestionType.auto,
        status: SocialSuggestionStatus.new,
        message: "Cabins are 90% full next weekend. Post a countdown and early-book CTA.",
        category: SocialContentCategory.general,
        platform: SocialPlatform.facebook,
        proposedDate: addDays(new Date(), 2),
        reason: { occupancyRatio: 0.9 }
      }
    }),
    prisma.socialSuggestion.create({
      data: {
        campgroundId,
        type: SocialSuggestionType.auto,
        status: SocialSuggestionStatus.new,
        message: "Cornhole tournament signups are light. Share a reminder + prize tease.",
        category: SocialContentCategory.events,
        platform: SocialPlatform.instagram,
        proposedDate: addDays(new Date(), 3),
        reason: { event: "Cornhole tournament", utilization: 0.35 }
      }
    })
  ]);

  await prisma.socialWeeklyIdea.create({
    data: {
      campgroundId,
      generatedFor: addDays(new Date(), -((new Date().getDay() + 6) % 7)), // anchor to Monday
      ideas: [
        { type: "promotional", idea: "Early-bird bundle for July 4th", platform: "facebook" },
        { type: "engagement", idea: "Staff story or fun moment", platform: "instagram" },
        { type: "behind_the_scenes", idea: "Cabin prep timelapse", platform: "tiktok" }
      ] as any,
      cadence: [
        { day: "Tuesday", theme: "Book-Now Highlight" },
        { day: "Thursday", theme: "Staff Story" },
        { day: "Saturday", theme: "Guest Experience / UGC" }
      ] as any
    }
  });

  await prisma.socialStrategy.create({
    data: {
      campgroundId,
      month: seasonStart,
      annual: false,
      plan: {
        hero: "Summer kickoff weekend",
        topIdeas: ["Pool opening", "Staff spotlight", "Early-bird bundle"]
      } as any
    }
  });

  await prisma.socialOpportunityAlert.createMany({
    data: [
      {
        campgroundId,
        category: SocialAlertCategory.weather,
        message: "Warm weekend ahead — push pool content",
        startsAt: new Date(),
        endsAt: addDays(new Date(), 3)
      },
      {
        campgroundId,
        category: SocialAlertCategory.occupancy,
        message: "Cabins nearly full next weekend. Encourage early booking for July 4.",
        startsAt: new Date(),
        endsAt: addDays(new Date(), 7)
      }
    ]
  });

  await prisma.socialPerformanceInput.create({
    data: {
      campgroundId,
      postId: posts[0].id,
      likes: 42,
      reach: 1200,
      comments: 6,
      shares: 3,
      saves: 4,
      notes: "Opening weekend teaser performed well.",
      recordedAt: new Date()
    }
  });

  console.log("  Social planner demo data seeded");
}

async function seedPosData(
  campgroundId: string,
  siteLookup: Map<string, { name: string }>,
  guests: { id: string }[],
  reservations: { id: string; guestId: string; siteId: string }[]
) {
  const category = await prisma.productCategory.create({
    data: {
      campgroundId,
      name: "Camp Store"
    }
  });

  const products = await prisma.$transaction([
    prisma.product.create({
      data: {
        campgroundId,
        categoryId: category.id,
        name: "Firewood Bundle",
        description: "Seasoned hardwood bundle",
        priceCents: 1200,
        sku: "WOOD-BDL",
        stockQty: 120,
        trackInventory: true,
        glCode: GL_CODES.SITE_REVENUE
      }
    }),
    prisma.product.create({
      data: {
        campgroundId,
        categoryId: category.id,
        name: "Ice Bag",
        description: "10 lb bag of ice",
        priceCents: 400,
        sku: "ICE-10LB",
        stockQty: 200,
        trackInventory: true,
        glCode: GL_CODES.SITE_REVENUE
      }
    }),
    prisma.product.create({
      data: {
        campgroundId,
        categoryId: category.id,
        name: "S'mores Kit",
        description: "Chocolate, marshmallows, graham crackers for 4",
        priceCents: 950,
        sku: "SMORES-KIT",
        stockQty: 80,
        trackInventory: true,
        glCode: GL_CODES.SITE_REVENUE
      }
    })
  ]);

  const addOns = await prisma.$transaction([
    prisma.addOnService.create({
      data: {
        campgroundId,
        name: "Early Check-in",
        description: "Arrive up to 2 hours early",
        priceCents: 2500,
        pricingType: "flat",
        glCode: GL_CODES.FEES_REVENUE
      }
    }),
    prisma.addOnService.create({
      data: {
        campgroundId,
        name: "Late Checkout",
        description: "Stay until 2pm",
        priceCents: 2000,
        pricingType: "flat",
        glCode: GL_CODES.FEES_REVENUE
      }
    })
  ]);

  const orderReservations = reservations.slice(0, 6);
  await prisma.$transaction(
    orderReservations.map((res, idx) =>
      prisma.storeOrder.create({
        data: {
          campgroundId,
          reservationId: res.id,
          guestId: res.guestId,
          siteNumber: siteLookup.get(res.siteId)?.name,
          status: idx % 2 === 0 ? "completed" : "pending",
          paymentMethod: idx % 2 === 0 ? "card" : "cash",
          subtotalCents: 1200 + 950,
          taxCents: 180,
          totalCents: 2330,
          notes: idx % 2 === 0 ? "Delivered to site" : "Pickup at store",
          items: {
            create: [
              {
                productId: products[0].id,
                name: products[0].name,
                qty: 1,
                unitCents: products[0].priceCents,
                totalCents: products[0].priceCents
              },
              {
                productId: products[2].id,
                name: products[2].name,
                qty: 1,
                unitCents: products[2].priceCents,
                totalCents: products[2].priceCents
              },
              ...(idx % 3 === 0
                ? [
                  {
                    addOnId: addOns[0].id,
                    name: addOns[0].name,
                    qty: 1,
                    unitCents: addOns[0].priceCents,
                    totalCents: addOns[0].priceCents
                  }
                ]
                : [])
            ]
          }
        }
      })
    )
  );

  console.log("  POS products and orders seeded");
}

async function seedActivitiesData(
  campgroundId: string,
  guests: { id: string }[],
  reservations: { id: string; guestId: string }[]
) {
  const activities = await prisma.$transaction([
    prisma.activity.create({
      data: {
        campgroundId,
        name: "Guided Kayak Tour",
        description: "Sunrise paddle with guide and gear included.",
        images: [],
        price: 4500,
        duration: 120,
        capacity: 12
      }
    }),
    prisma.activity.create({
      data: {
        campgroundId,
        name: "Kids Crafts",
        description: "Drop-in crafts for ages 5-12.",
        images: [],
        price: 0,
        duration: 60,
        capacity: 20
      }
    })
  ]);

  const sessions = await prisma.$transaction([
    prisma.activitySession.create({
      data: {
        activityId: activities[0].id,
        startTime: addDays(new Date(), 5),
        endTime: addDays(new Date(), 5),
        capacity: 12,
        status: "scheduled"
      }
    }),
    prisma.activitySession.create({
      data: {
        activityId: activities[0].id,
        startTime: addDays(new Date(), 12),
        endTime: addDays(new Date(), 12),
        capacity: 10,
        status: "scheduled"
      }
    }),
    prisma.activitySession.create({
      data: {
        activityId: activities[1].id,
        startTime: addDays(new Date(), 3),
        endTime: addDays(new Date(), 3),
        capacity: 20,
        status: "scheduled"
      }
    })
  ]);

  const bookings = await prisma.$transaction(
    sessions.slice(0, 3).map((session, idx) => {
      const guest = guests[idx % guests.length];
      const res = reservations[idx % reservations.length];
      return prisma.activityBooking.create({
        data: {
          sessionId: session.id,
          guestId: guest.id,
          reservationId: res.id,
          quantity: idx % 2 === 0 ? 2 : 1,
          totalAmount: idx % 2 === 0 ? 9000 : 4500,
          status: idx % 3 === 0 ? "cancelled" : "confirmed"
        }
      });
    })
  );

  console.log(`  Activities seeded (${activities.length} activities, ${bookings.length} bookings)`);
}

async function seedWaitlistAndHolds(
  campgroundId: string,
  sites: { id: string; name: string; siteClassId: string | null }[],
  siteClasses: { id: string; siteType: SiteType }[],
  guests: { id: string; primaryFirstName?: string; primaryLastName?: string }[]
) {
  const targetSite = sites.find((s) => s.name.startsWith("P")) ?? sites[0];
  const siteClass = siteClasses.find((c) => c.siteType === SiteType.rv) ?? siteClasses[0];

  await prisma.waitlistEntry.createMany({
    data: [
      {
        campgroundId,
        guestId: guests[0]?.id,
        siteId: targetSite?.id,
        arrivalDate: addDays(new Date(), 30),
        departureDate: addDays(new Date(), 33),
        status: "active",
        type: "regular",
        notes: "Prefers pull-through, 50A"
      },
      {
        campgroundId,
        siteTypeId: siteClass?.id,
        arrivalDate: addDays(new Date(), 120),
        departureDate: addDays(new Date(), 210),
        status: "active",
        type: "seasonal",
        contactName: "Seasonal Lead",
        contactEmail: "seasonal@example.com",
        notes: "Seasonal stay request"
      },
      {
        campgroundId,
        guestId: guests[2]?.id,
        status: "fulfilled",
        type: "regular",
        notes: "Already booked elsewhere, keep for fall"
      }
    ]
  });

  await prisma.siteHold.createMany({
    data: [
      {
        campgroundId,
        siteId: targetSite?.id ?? sites[0].id,
        arrivalDate: addDays(new Date(), 10),
        departureDate: addDays(new Date(), 12),
        expiresAt: addDays(new Date(), 2),
        status: "active",
        note: "Holding for OTA import"
      },
      {
        campgroundId,
        siteId: sites[1]?.id ?? sites[0].id,
        arrivalDate: addDays(new Date(), 45),
        departureDate: addDays(new Date(), 48),
        status: "released",
        note: "Released after guest cancelled"
      }
    ]
  });

  await prisma.blackoutDate.createMany({
    data: [
      {
        campgroundId,
        siteId: null,
        startDate: addDays(new Date(), 60),
        endDate: addDays(new Date(), 62),
        reason: "Private event"
      },
      {
        campgroundId,
        siteId: targetSite?.id ?? sites[0].id,
        startDate: addDays(new Date(), 15),
        endDate: addDays(new Date(), 18),
        reason: "Maintenance"
      }
    ]
  });

  console.log("  Waitlist, holds, and blackout dates seeded");
}

async function seedMemberships(
  campgroundId: string,
  guests: { id: string }[],
  vibe: string
) {
  const isResort = vibe.includes("resort");
  const membershipType = await prisma.membershipType.create({
    data: {
      campgroundId,
      name: isResort ? "Resort Annual" : "Local Seasonal",
      description: "Includes discounts on stays and activities",
      price: isResort ? 120000 : 85000,
      durationDays: 365,
      discountPercent: isResort ? 12 : 8,
      isActive: true
    }
  });

  const seasonalGuests = guests.slice(0, 3);
  await prisma.$transaction(
    seasonalGuests.map((guest, idx) =>
      prisma.guestMembership.create({
        data: {
          membershipTypeId: membershipType.id,
          guestId: guest.id,
          startDate: addDays(new Date(), -90 + idx * 5),
          endDate: addDays(new Date(), 270),
          status: idx === 2 ? "expired" : "active",
          purchaseAmount: membershipType.price
        }
      })
    )
  );

  console.log("  Memberships seeded");
}

async function seedGamification(
  campgroundId: string,
  memberships: { userId: string; id: string; role: UserRole }[]
) {
  await prisma.gamificationSetting.upsert({
    where: { campgroundId },
    update: { enabled: true, enabledRoles: [UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.maintenance] },
    create: { campgroundId, enabled: true, enabledRoles: [UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.maintenance] }
  });

  const xpRules = await prisma.$transaction([
    prisma.xpRule.upsert({
      where: { campgroundId_category: { campgroundId, category: GamificationEventCategory.check_in } },
      update: { defaultXp: 15 },
      create: { campgroundId, category: GamificationEventCategory.check_in, defaultXp: 15 }
    }),
    prisma.xpRule.upsert({
      where: { campgroundId_category: { campgroundId, category: GamificationEventCategory.maintenance } },
      update: { defaultXp: 25 },
      create: { campgroundId, category: GamificationEventCategory.maintenance, defaultXp: 25 }
    }),
    prisma.xpRule.upsert({
      where: { campgroundId_category: { campgroundId, category: GamificationEventCategory.task } },
      update: { defaultXp: 10 },
      create: { campgroundId, category: GamificationEventCategory.task, defaultXp: 10 }
    })
  ]);

  const xpBalances = await prisma.$transaction(
    memberships.slice(0, 4).map((mem, idx) =>
      prisma.xpBalance.upsert({
        where: { campgroundId_userId: { campgroundId, userId: mem.userId } },
        update: { totalXp: 300 + idx * 50, currentLevel: 1 + idx },
        create: {
          campgroundId,
          userId: mem.userId,
          totalXp: 300 + idx * 50,
          currentLevel: 1 + idx,
          lastEventAt: addDays(new Date(), -idx)
        }
      })
    )
  );

  await prisma.$transaction(
    xpBalances.map((balance, idx) =>
      prisma.xpEvent.create({
        data: {
          campgroundId,
          userId: balance.userId,
          membershipId: memberships[idx]?.id,
          category: idx % 2 === 0 ? GamificationEventCategory.check_in : GamificationEventCategory.maintenance,
          xp: 15 + idx * 5,
          reason: idx % 2 === 0 ? "Smooth check-in" : "Resolved maintenance ticket quickly",
          sourceType: "seed",
          occurredAt: addDays(new Date(), -idx * 2)
        }
      })
    )
  );

  console.log(`  Gamification seeded (${xpRules.length} rules, ${xpBalances.length} balances)`);
}

async function seedDisputes(
  campgroundId: string,
  reservations: { id: string; campgroundId: string }[]
) {
  const target = reservations.slice(0, 2);
  if (!target.length) return;

  await prisma.$transaction(
    target.map((res, idx) =>
      prisma.dispute.create({
        data: {
          campgroundId,
          reservationId: res.id,
          stripeDisputeId: `dp_${campgroundId}_${idx}_${Date.now()}`,
          stripeChargeId: `ch_${campgroundId}_${idx}`,
          amountCents: 5000 + idx * 1500,
          reason: idx === 0 ? "duplicate" : "fraudulent",
          status: idx === 0 ? "warning_needs_response" : "needs_response",
          evidenceDueBy: addDays(new Date(), 10 + idx)
        }
      })
    )
  );

  console.log("  Disputes seeded");
}

async function seedReservationsWithFinancials(
  campgroundId: string,
  sites: { id: string; siteClassId: string | null; siteType: SiteType; name: string }[],
  guests: { id: string; primaryFirstName: string; primaryLastName: string }[],
  classes: { id: string; name: string; defaultRate?: number }[],
  seasonalRates: { id: string; name: string; siteClassId: string | null }[]
) {
  const siteBookings = new Map<string, { start: Date; end: Date }[]>();
  const reservations: Awaited<ReturnType<typeof prisma.reservation.create>>[] = [];
  let paymentCount = 0;
  let ledgerCount = 0;
  let repeatChargeCount = 0;

  const perYearCounts = (year: number) => {
    const base = Math.max(25, Math.min(120, Math.round(sites.length * 0.9)));
    if (year >= 2024) return Math.round(base * 1.1);
    if (year <= 2021) return Math.round(base * 0.75);
    return base;
  };

  const createReservation = async (year: number, stayType: StayType, isFuture = false) => {
    let site: (typeof sites)[number] | undefined;
    let dates: ReturnType<typeof randomReservationDatesForYear> | undefined;

    for (let attempts = 0; attempts < 25; attempts++) {
      const candidateSite = pick(sites);
      const candidateDates = randomReservationDatesForYear(year, stayType);
      const bookings = siteBookings.get(candidateSite.id) || [];
      const overlap = bookings.some(
        (b) => candidateDates.arrivalDate < b.end && candidateDates.departureDate > b.start
      );
      if (!overlap) {
        site = candidateSite;
        dates = candidateDates;
        siteBookings.set(candidateSite.id, [...bookings, { start: candidateDates.arrivalDate, end: candidateDates.departureDate }]);
        break;
      }
    }

    if (!site || !dates) return;

    const guest = pick(guests);
    const cls = classes.find((c) => c.id === site!.siteClassId) || classes[0];
    const baseRate = cls?.defaultRate ?? 7500;
    const baseSubtotal = Math.round(baseRate * (stayType === StayType.monthly ? dates.nights / 1.05 : stayType === StayType.seasonal ? dates.nights / 1.15 : dates.nights));
    const feesAmount = randomBetween(0, 2200);
    const taxesAmount = Math.round((baseSubtotal + feesAmount) * 0.0835);
    const discountsAmount = (dates.nights > 20 || stayType !== StayType.standard) && randomBetween(0, 1) === 1 ? randomBetween(1500, 4000) : 0;
    const totalAmount = Math.max(0, baseSubtotal + feesAmount + taxesAmount - discountsAmount);
    const depositAmount = Math.round(Math.min(totalAmount, baseRate));
    const leadTimeDays = randomBetween(2, 160);
    const bookedAt = addDays(dates.arrivalDate, -leadTimeDays);

    let paidAmount: number;
    if (isFuture && year === 2026) {
      paidAmount = randomBetween(0, totalAmount * 0.5);
    } else {
      paidAmount = totalAmount === 0 ? 0 : pick([totalAmount, totalAmount, Math.round(totalAmount * 0.5), 0]);
    }
    const paymentStatus = paidAmount === 0 ? "unpaid" : paidAmount >= totalAmount ? "paid" : "partial";

    const statusPool =
      year <= 2022
        ? [ReservationStatus.checked_out, ReservationStatus.checked_out, ReservationStatus.cancelled, ReservationStatus.confirmed]
        : year <= 2024
          ? [ReservationStatus.checked_out, ReservationStatus.checked_in, ReservationStatus.confirmed, ReservationStatus.cancelled]
          : isFuture
            ? [ReservationStatus.pending, ReservationStatus.confirmed, ReservationStatus.cancelled, ReservationStatus.confirmed]
            : [ReservationStatus.confirmed, ReservationStatus.checked_in, ReservationStatus.checked_out, ReservationStatus.pending];
    const status = pick(statusPool);

    const seasonalRateId = stayType === StayType.seasonal || stayType === StayType.monthly ? seasonalRates.find((r) => !r.siteClassId || r.siteClassId === site!.siteClassId)?.id ?? null : null;

    const reservation = await prisma.reservation.create({
      data: {
        campgroundId,
        siteId: site!.id,
        guestId: guest.id,
        arrivalDate: dates.arrivalDate,
        departureDate: dates.departureDate,
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
        promoCode: totalAmount > 50000 && randomBetween(0, 4) === 0 ? "SUMMER20" : null,
        source: pick(["phone", "web", "ota", "walk-in"]),
        checkInWindowStart: "14:00",
        checkInWindowEnd: "21:00",
        vehiclePlate: `${pick(["ABC", "XYZ", "DEF", "GHI"])}-${randomBetween(1000, 9999)}`,
        vehicleState: pick(["MN", "WI", "IA", "CO", "TX", "UT", "CA"]),
        rigType: site!.siteType === SiteType.rv ? pick(["Class A", "Fifth Wheel", "Travel Trailer"]) : null,
        rigLength: site!.siteType === SiteType.rv ? randomBetween(28, 44) : null,
        depositAmount,
        depositDueDate: addDays(bookedAt, 2),
        leadTimeDays,
        bookedAt,
        stayType,
        seasonalRateId
      }
    });
    reservations.push(reservation);

    if (paidAmount > 0) {
      const paymentDate = addDays(dates.arrivalDate, -randomBetween(1, 21));

      await prisma.payment.create({
        data: {
          campgroundId,
          reservationId: reservation.id,
          amountCents: paidAmount,
          method: pick(["card", "card", "card", "cash", "check"]),
          direction: "charge",
          note: paidAmount === totalAmount ? "Full payment" : "Deposit payment",
          createdAt: paymentDate
        }
      });
      paymentCount++;

      await prisma.ledgerEntry.create({
        data: {
          campgroundId,
          reservationId: reservation.id,
          glCode: GL_CODES.CASH,
          account: "Cash",
          description: `Payment received - ${guest.primaryFirstName} ${guest.primaryLastName}`,
          amountCents: paidAmount,
          direction: "debit",
          occurredAt: paymentDate
        }
      });
      ledgerCount++;

      await prisma.ledgerEntry.create({
        data: {
          campgroundId,
          reservationId: reservation.id,
          glCode: GL_CODES.SITE_REVENUE,
          account: "Site Revenue",
          description: `Site rental - ${site!.name}`,
          amountCents: baseSubtotal,
          direction: "credit",
          occurredAt: paymentDate
        }
      });
      ledgerCount++;

      if (feesAmount > 0) {
        await prisma.ledgerEntry.create({
          data: {
            campgroundId,
            reservationId: reservation.id,
            glCode: GL_CODES.FEES_REVENUE,
            account: "Fees Revenue",
            description: "Booking fees",
            amountCents: feesAmount,
            direction: "credit",
            occurredAt: paymentDate
          }
        });
        ledgerCount++;
      }

      if (taxesAmount > 0) {
        await prisma.ledgerEntry.create({
          data: {
            campgroundId,
            reservationId: reservation.id,
            glCode: GL_CODES.TAX_PAYABLE,
            account: "Sales Tax Payable",
            description: "Sales tax collected",
            amountCents: taxesAmount,
            direction: "credit",
            occurredAt: paymentDate
          }
        });
        ledgerCount++;
      }
    }

    if (stayType === StayType.monthly || stayType === StayType.seasonal) {
      const installments = stayType === StayType.monthly ? 2 : 3;
      for (let i = 0; i < installments; i++) {
        await prisma.repeatCharge.create({
          data: {
            reservationId: reservation.id,
            amount: Math.round(totalAmount / installments),
            dueDate: addDays(dates.arrivalDate, (i + 1) * 30),
            status: i === 0 ? ChargeStatus.paid : i === installments - 1 && randomBetween(0, 1) === 1 ? ChargeStatus.failed : ChargeStatus.pending,
            paidAt: i === 0 ? addDays(dates.arrivalDate, -2) : null,
            failureReason: i === installments - 1 && randomBetween(0, 1) === 1 ? "Card declined" : null
          }
        });
        repeatChargeCount++;
      }
    }
  };

  for (const year of [2020, 2021, 2022, 2023, 2024, 2025]) {
    const count = perYearCounts(year);
    for (let i = 0; i < count; i++) {
      const stayType = pick([StayType.standard, StayType.standard, StayType.weekly, StayType.monthly, StayType.seasonal]);
      await createReservation(year, stayType, false);
    }
  }

  // Pre-reservations for 2026
  const futureCount = Math.max(40, Math.min(90, Math.round(sites.length * 0.6)));
  for (let i = 0; i < futureCount; i++) {
    const stayType = pick([StayType.standard, StayType.weekly, StayType.monthly]);
    await createReservation(2026, stayType, true);
  }

  console.log(`  Created ${reservations.length} reservations, ${paymentCount} payments, ${ledgerCount} ledger entries, ${repeatChargeCount} repeat charges`);
  return reservations;
}

async function seedCampground(
  config: (typeof seededCampgrounds)[number],
  orgId: string,
  users: { id: string; email: string }[]
) {
  const season = seasonForYear(2025);
  const rateMultiplier =
    config.size === "resort" ? 1.3 : config.vibe === "boutique" ? 1.1 : config.size === "mom_pop" ? 0.85 : 1;
  const siteMix = {
    premium: config.size === "resort" ? 28 : config.size === "mom_pop" ? 8 : 16,
    standard: config.size === "resort" ? 42 : config.size === "mom_pop" ? 12 : 22,
    tent: config.size === "resort" ? 18 : config.size === "mom_pop" ? 14 : 12,
    cabin: config.size === "resort" ? 14 : config.size === "mom_pop" ? 6 : 8,
    group: config.size === "resort" ? 6 : 3,
    glamping: config.size === "resort" || config.vibe === "boutique" ? 6 : 0
  };

  const vibeMeta = (() => {
    switch (config.vibe) {
      case "river":
        return {
          description:
            "Riverbend offers bluffs and Mississippi views with fishing docks and shaded tent meadows.",
          tagline: "River views, river vibes",
          amenities: ["WiFi", "Pool", "Laundry", "Camp Store", "Fishing Dock", "Boat Ramp", "Playground", "Fire Pits", "Showers", "Pet Friendly"],
          hero: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200",
          photos: [
            "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800",
            "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?w=800",
            "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800"
          ],
          lat: 44.0498,
          lng: -91.6391,
          postal: "55987",
          taxState: 0.0685,
          taxLocal: 0.015
        };
      case "mountain":
        return {
          description:
            "Mountain Base sits at the foot of fourteeners with access to biking, rafting, and hot springs.",
          tagline: "Adventure starts here",
          amenities: ["WiFi", "Hot Tub", "Laundry", "Camp Store", "Hiking Trails", "Mountain Views", "Fire Pits", "Showers", "Pet Friendly", "Bike Rentals"],
          hero: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200",
          photos: [
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
            "https://images.unsplash.com/photo-1445307806294-bff7f67ff225?w=800"
          ],
          lat: 38.5347,
          lng: -106.0012,
          postal: "81201",
          taxState: 0.028,
          taxLocal: 0.04
        };
      case "desert_resort":
        return {
          description:
            "Sunset Sands is a destination RV resort near slickrock with a pool, spa, and guided excursions.",
          tagline: "Desert sunsets and resort perks",
          amenities: ["WiFi", "Pool", "Spa", "Laundry", "Camp Store", "Restaurant", "Bike Rentals", "UTV Parking", "Pickleball", "Pet Friendly"],
          hero: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200",
          photos: [
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
          ],
          lat: 38.5733,
          lng: -109.5498,
          postal: "84532",
          taxState: 0.061,
          taxLocal: 0.03
        };
      case "boutique":
        return {
          description:
            "Blueberry Hill is a boutique cabin and camp blend with curated activities and chef-led weekends.",
          tagline: "Cozy cabins, curated stays",
          amenities: ["WiFi", "Coffee Bar", "Laundry", "Camp Store", "Yoga Lawn", "Fire Pits", "Bathhouse", "Pet Friendly", "Live Music Patio"],
          hero: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200",
          photos: [
            "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",
            "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
            "https://images.unsplash.com/photo-1470246973918-29a93221c455?w=800"
          ],
          lat: 35.5951,
          lng: -82.5515,
          postal: "28801",
          taxState: 0.0475,
          taxLocal: 0.025
        };
      default:
        return {
          description:
            "Redwood Ridge Hideout is a family-owned forest escape with big trees, quiet nights, and friendly hosts.",
          tagline: "Under the redwoods",
          amenities: ["WiFi", "Laundry", "Camp Store", "Hiking Trails", "Shuttle to Town", "Fire Pits", "Showers", "Pet Friendly"],
          hero: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
          photos: [
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
            "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",
            "https://images.unsplash.com/photo-1476041800959-2f6bb412c8ce?w=800"
          ],
          lat: 40.8021,
          lng: -124.1637,
          postal: "95501",
          taxState: 0.0725,
          taxLocal: 0.015
        };
    }
  })();

  const existing = await prisma.campground.findUnique({ where: { slug: config.slug } });
  if (existing) {
    console.log(`Re-seeding ${config.slug} (scoped cleanup)...`);
    await resetCampgroundData(existing.id);
  }

  const cg = existing
    ? await prisma.campground.update({
      where: { id: existing.id },
      data: {
        organizationId: orgId,
        name: config.name,
        slug: config.slug,
        city: config.city,
        state: config.state,
        country: "USA",
        address1: `${config.city} Basecamp Rd`,
        postalCode: vibeMeta.postal,
        latitude: vibeMeta.lat,
        longitude: vibeMeta.lng,
        timezone: config.timezone,
        phone: "555-CAMP-123",
        email: `info@${config.slug}.com`,
        website: `https://${config.slug}.com`,
        facebookUrl: `https://facebook.com/${config.slug}`,
        instagramUrl: `https://instagram.com/${config.slug}`,
        description: vibeMeta.description,
        tagline: vibeMeta.tagline,
        amenities: vibeMeta.amenities,
        photos: vibeMeta.photos,
        heroImageUrl: vibeMeta.hero,
        isPublished: true,
        seasonStart: season.start,
        seasonEnd: season.end,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        taxState: vibeMeta.taxState,
        taxLocal: vibeMeta.taxLocal,
        depositRule: config.size === "resort" ? "percentage" : "first_night",
        depositPercentage: config.size === "resort" ? 25 : null
      }
    })
    : await prisma.campground.create({
      data: {
        organizationId: orgId,
        name: config.name,
        slug: config.slug,
        city: config.city,
        state: config.state,
        country: "USA",
        address1: `${config.city} Basecamp Rd`,
        postalCode: vibeMeta.postal,
        latitude: vibeMeta.lat,
        longitude: vibeMeta.lng,
        timezone: config.timezone,
        phone: "555-CAMP-123",
        email: `info@${config.slug}.com`,
        website: `https://${config.slug}.com`,
        facebookUrl: `https://facebook.com/${config.slug}`,
        instagramUrl: `https://instagram.com/${config.slug}`,
        description: vibeMeta.description,
        tagline: vibeMeta.tagline,
        amenities: vibeMeta.amenities,
        photos: vibeMeta.photos,
        heroImageUrl: vibeMeta.hero,
        isPublished: true,
        seasonStart: season.start,
        seasonEnd: season.end,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        taxState: vibeMeta.taxState,
        taxLocal: vibeMeta.taxLocal,
        depositRule: config.size === "resort" ? "percentage" : "first_night",
        depositPercentage: config.size === "resort" ? 25 : null
      }
    });

  const membershipDefs = [
    { user: users[0], role: UserRole.owner },
    { user: users[1], role: UserRole.owner },
    { user: users[2], role: UserRole.manager },
    { user: users[3], role: UserRole.front_desk },
    { user: users[4], role: UserRole.maintenance },
    { user: users[5], role: UserRole.finance },
    { user: users[6], role: UserRole.marketing }
  ].filter(Boolean) as { user: { id: string }; role: UserRole }[];

  const memberships = [];
  for (const mem of membershipDefs) {
    memberships.push(
      await prisma.campgroundMembership.create({
        data: { userId: mem.user.id, campgroundId: cg.id, role: mem.role }
      })
    );
  }
  console.log(`  Created campground memberships for ${memberships.length} users`);

  const classes = await prisma.$transaction(
    buildSiteClasses(cg.id, { rateMultiplier, addGlamping: siteMix.glamping > 0 }).map((data) => prisma.siteClass.create({ data }))
  );
  console.log(`  Created ${classes.length} site classes`);

  const siteData = buildSites(cg.id, classes, siteMix);
  const sites = await prisma.$transaction(siteData.map((data) => prisma.site.create({ data })));
  console.log(`  Created ${sites.length} sites`);

  const guestCount = config.size === "resort" ? 420 : config.size === "mom_pop" ? 180 : 260;
  const guests = await prisma.$transaction(
    generateGuests(guestCount, config.guestOffset, config.slug).map((data) =>
      prisma.guest.upsert({
        where: { email: data.email },
        update: {},
        create: data
      })
    )
  );
  console.log(`  Created ${guests.length} guests`);

  const pricingRules = await prisma.$transaction(
    buildPricingRules(cg.id, classes).map((data) => prisma.pricingRule.create({ data }))
  );
  console.log(`  Created ${pricingRules.length} pricing rules`);

  const seasonalRates = await prisma.$transaction(
    buildSeasonalRates(cg.id, classes).map((data) => prisma.seasonalRate.create({ data }))
  );
  console.log(`  Created ${seasonalRates.length} seasonal/long-stay rates`);

  const maintenanceData = buildMaintenanceTickets(cg.id, sites);
  await prisma.$transaction(maintenanceData.map((data) => prisma.maintenanceTicket.create({ data })));
  console.log(`  Created ${maintenanceData.length} maintenance tickets`);

  const eventsData = buildEvents(cg.id, config.state, season.start);
  await prisma.$transaction(eventsData.map((data) => prisma.event.create({ data })));
  console.log(`  Created ${eventsData.length} events`);

  // await seedSocialPlanner(cg.id, season.start); // Commented out: SocialPost table doesn't exist yet

  await prisma.promotion.upsert({
    where: { campgroundId_code: { campgroundId: cg.id, code: "SUMMER20" } },
    update: { isActive: true },
    create: {
      campgroundId: cg.id,
      code: "SUMMER20",
      type: "percentage",
      value: 20,
      description: "Summer Sale 20% Off",
      isActive: true
    }
  });

  const reservations = await seedReservationsWithFinancials(cg.id, sites, guests, classes, seasonalRates);

  const siteLookup = new Map(sites.map((s) => [s.id, { name: s.name }]));
  await seedPosData(cg.id, siteLookup, guests, reservations);
  await seedActivitiesData(cg.id, guests, reservations);
  await seedWaitlistAndHolds(cg.id, sites, classes, guests);
  await seedMemberships(cg.id, guests, config.vibe);
  await seedGamification(cg.id, memberships);
  await seedDisputes(cg.id, reservations);

  console.log(`  Finished seeding campground ${config.name}\n`);
  return cg;
}

async function seedApprovalPolicies() {
  console.log("Seeding approval policies...");

  // Delete existing policies first to avoid duplicates
  await prisma.approvalPolicy.deleteMany({});

  const policies = await prisma.$transaction([
    // Global policies (no campgroundId)
    prisma.approvalPolicy.create({
      data: {
        name: "Refunds over $250",
        action: "refund",
        appliesTo: ["refund"],
        thresholdCents: 25000,
        currency: "USD",
        approversNeeded: 2,
        description: "Dual control for refunds above $250. Requires two authorized staff members to approve.",
        approverRoles: [UserRole.owner, UserRole.manager, UserRole.finance],
        isActive: true
      }
    }),
    prisma.approvalPolicy.create({
      data: {
        name: "Payout releases",
        action: "payout",
        appliesTo: ["payout"],
        currency: "USD",
        approversNeeded: 2,
        description: "Require two approvers for all operator payouts to ensure financial oversight.",
        approverRoles: [UserRole.owner, UserRole.finance],
        isActive: true
      }
    }),
    prisma.approvalPolicy.create({
      data: {
        name: "High-value config changes",
        action: "config_change",
        appliesTo: ["config_change"],
        currency: "USD",
        approversNeeded: 1,
        description: "Pricing, tax, and currency changes require approval before taking effect.",
        approverRoles: [UserRole.owner, UserRole.manager],
        isActive: true
      }
    }),
    prisma.approvalPolicy.create({
      data: {
        name: "Large refunds (over $1000)",
        action: "refund",
        appliesTo: ["refund"],
        thresholdCents: 100000,
        currency: "USD",
        approversNeeded: 2,
        description: "Additional oversight for refunds over $1,000. Requires owner approval.",
        approverRoles: [UserRole.owner],
        isActive: true
      }
    })
  ]);

  console.log(`  Created ${policies.length} approval policies`);
  return policies;
}

async function main() {
  console.log("Starting seed...\n");

  // Create users first
  console.log("Creating users...");
  const users = await seedUsers();

  // Create organization
  let org = await prisma.organization.findFirst({ where: { name: "Keepr" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Keepr" }
    });
  }
  console.log(`\nOrganization ready: ${org.name}\n`);

  // Seed approval policies (global)
  await seedApprovalPolicies();

  for (const cgConfig of seededCampgrounds) {
    console.log(`Seeding campground: ${cgConfig.name}`);
    await seedCampground(cgConfig, org.id, users);
  }

  console.log("\nSeed complete!");
  console.log("\nTest Login Credentials:");
  console.log("   Email: admin@keeprstay.com");
  console.log("   Password: password123");
  console.log("\n   (All users share the same password)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
