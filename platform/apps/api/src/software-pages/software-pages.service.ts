import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Software Pages Service
 *
 * Serves B2B SEO pages for campground management software:
 * - Competitor comparison pages ("Campspot alternative", "vs Newbook")
 * - Feature-focused pages ("Best campground software with online booking")
 * - Industry pages ("RV Park Management Software")
 */

export interface SoftwarePageData {
  id: string;
  slug: string;
  pageType: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubheadline: string | null;
  content: Record<string, unknown>;
  isPublished: boolean;
  publishedAt: Date | null;
}

export interface CompetitorComparison {
  competitorName: string;
  competitorSlug: string;
  comparisonPoints: Array<{
    feature: string;
    ourValue: string;
    theirValue: string;
    advantage: "us" | "them" | "equal";
  }>;
  keyDifferentiators: string[];
  switchingBenefits: string[];
}

export interface FeaturePageData {
  feature: string;
  slug: string;
  title: string;
  description: string;
  benefits: string[];
  useCases: string[];
  testimonials: Array<{
    quote: string;
    author: string;
    role: string;
    campground: string;
  }>;
}

// Static competitor data (can be moved to database later)
const COMPETITORS: Record<string, CompetitorComparison> = {
  campspot: {
    competitorName: "Campspot",
    competitorSlug: "campspot",
    comparisonPoints: [
      {
        feature: "Pricing Model",
        ourValue: "Flat monthly rate",
        theirValue: "Per-booking commission",
        advantage: "us",
      },
      {
        feature: "Contract Terms",
        ourValue: "Month-to-month",
        theirValue: "Annual contract required",
        advantage: "us",
      },
      {
        feature: "Setup Fee",
        ourValue: "No setup fee",
        theirValue: "$500+ setup fee",
        advantage: "us",
      },
      {
        feature: "Online Booking",
        ourValue: "Included",
        theirValue: "Included",
        advantage: "equal",
      },
      {
        feature: "POS System",
        ourValue: "Fully integrated",
        theirValue: "Third-party integration",
        advantage: "us",
      },
      {
        feature: "Staff Scheduling",
        ourValue: "Built-in",
        theirValue: "Not available",
        advantage: "us",
      },
      {
        feature: "Loyalty Program",
        ourValue: "Included",
        theirValue: "Not available",
        advantage: "us",
      },
      {
        feature: "AI-Powered Pricing",
        ourValue: "Included",
        theirValue: "Not available",
        advantage: "us",
      },
    ],
    keyDifferentiators: [
      "No per-booking commissions eating into your revenue",
      "Month-to-month flexibility - no long-term contracts",
      "All-in-one platform: reservations, POS, staff scheduling, loyalty",
      "AI-powered dynamic pricing to maximize occupancy and revenue",
      "24/7 US-based support with dedicated account manager",
    ],
    switchingBenefits: [
      "Free data migration from Campspot",
      "30-day parallel running support",
      "Staff training included at no extra cost",
      "Typical savings of $200-500/month on software fees",
    ],
  },
  newbook: {
    competitorName: "Newbook",
    competitorSlug: "newbook",
    comparisonPoints: [
      {
        feature: "Pricing Transparency",
        ourValue: "Clear, published pricing",
        theirValue: "Quote-based pricing",
        advantage: "us",
      },
      {
        feature: "Implementation Time",
        ourValue: "1-2 weeks",
        theirValue: "4-8 weeks typical",
        advantage: "us",
      },
      {
        feature: "Mobile App",
        ourValue: "iOS & Android included",
        theirValue: "Limited mobile support",
        advantage: "us",
      },
      {
        feature: "Guest Portal",
        ourValue: "Self-service included",
        theirValue: "Additional module",
        advantage: "us",
      },
      {
        feature: "Reporting",
        ourValue: "Real-time dashboards",
        theirValue: "Standard reports",
        advantage: "us",
      },
      {
        feature: "Multi-property",
        ourValue: "Included in all plans",
        theirValue: "Enterprise only",
        advantage: "us",
      },
    ],
    keyDifferentiators: [
      "Transparent, flat-rate pricing with no hidden fees",
      "Quick implementation - go live in days, not months",
      "Modern, intuitive interface designed for ease of use",
      "Built-in loyalty and guest engagement tools",
      "Comprehensive mobile apps for staff and guests",
    ],
    switchingBenefits: [
      "Free data migration assistance",
      "Dedicated onboarding specialist",
      "30-day money-back guarantee",
      "No minimum contract period",
    ],
  },
  camplife: {
    competitorName: "CampLife",
    competitorSlug: "camplife",
    comparisonPoints: [
      {
        feature: "Online Booking",
        ourValue: "Branded booking engine",
        theirValue: "Basic booking widget",
        advantage: "us",
      },
      {
        feature: "Payment Processing",
        ourValue: "Integrated with low fees",
        theirValue: "Third-party required",
        advantage: "us",
      },
      {
        feature: "Guest Communication",
        ourValue: "Automated messaging",
        theirValue: "Manual only",
        advantage: "us",
      },
      {
        feature: "Channel Manager",
        ourValue: "Included",
        theirValue: "Additional cost",
        advantage: "us",
      },
      {
        feature: "Dynamic Pricing",
        ourValue: "AI-powered",
        theirValue: "Not available",
        advantage: "us",
      },
      {
        feature: "Support",
        ourValue: "24/7 phone & chat",
        theirValue: "Business hours email",
        advantage: "us",
      },
    ],
    keyDifferentiators: [
      "Modern cloud-based platform vs legacy software",
      "Comprehensive automation reduces manual work",
      "Real-time availability across all booking channels",
      "Built-in marketing tools to drive direct bookings",
      "Professional booking experience that converts",
    ],
    switchingBenefits: [
      "Seamless data migration from CampLife",
      "Staff training and onboarding support",
      "Dedicated success manager for first 90 days",
      "Price-match guarantee for first year",
    ],
  },
  rms: {
    competitorName: "RMS Cloud",
    competitorSlug: "rms",
    comparisonPoints: [
      {
        feature: "Ease of Use",
        ourValue: "Intuitive, modern UI",
        theirValue: "Complex, learning curve",
        advantage: "us",
      },
      {
        feature: "Setup Complexity",
        ourValue: "Self-service possible",
        theirValue: "Professional services required",
        advantage: "us",
      },
      {
        feature: "Pricing",
        ourValue: "Affordable for small parks",
        theirValue: "Enterprise pricing",
        advantage: "us",
      },
      {
        feature: "Feature Set",
        ourValue: "Focused on essentials",
        theirValue: "Complex, many modules",
        advantage: "equal",
      },
      {
        feature: "Updates",
        ourValue: "Continuous, automatic",
        theirValue: "Periodic releases",
        advantage: "us",
      },
      {
        feature: "Integration",
        ourValue: "Open API included",
        theirValue: "API available",
        advantage: "equal",
      },
    ],
    keyDifferentiators: [
      "Right-sized solution for independent parks",
      "No IT department required to implement or maintain",
      "Affordable pricing that grows with your business",
      "Focus on what matters: bookings, guests, revenue",
      "Modern technology without enterprise complexity",
    ],
    switchingBenefits: [
      "Simplified operations from day one",
      "Significant cost savings vs RMS",
      "Faster staff onboarding",
      "Free data migration assistance",
    ],
  },
};

// Feature pages data
const FEATURE_PAGES: Record<string, FeaturePageData> = {
  "online-booking": {
    feature: "Online Booking",
    slug: "online-booking",
    title: "Campground Online Booking Software",
    description:
      "Accept reservations 24/7 with a branded booking engine that integrates with your website.",
    benefits: [
      "Increase bookings by 30% with 24/7 online availability",
      "Reduce phone calls and manual data entry",
      "Collect payments automatically with integrated processing",
      "Real-time availability prevents double bookings",
      "Mobile-optimized for guests booking on the go",
    ],
    useCases: [
      "Last-minute bookings when office is closed",
      "Group reservations with multiple sites",
      "Seasonal rate changes applied automatically",
      "Deposit collection and balance reminders",
    ],
    testimonials: [
      {
        quote:
          "Our online bookings went from 20% to 65% in the first month. The booking engine is so easy for guests to use.",
        author: "Sarah M.",
        role: "Owner",
        campground: "Pine Valley RV Resort",
      },
    ],
  },
  "dynamic-pricing": {
    feature: "Dynamic Pricing",
    slug: "dynamic-pricing",
    title: "AI-Powered Dynamic Pricing for Campgrounds",
    description:
      "Maximize revenue with intelligent pricing that adjusts based on demand, seasonality, and occupancy.",
    benefits: [
      "Increase revenue by 15-25% with optimized rates",
      "Fill more sites during slow periods",
      "Capture premium rates during high demand",
      "Set rules and let AI handle the rest",
      "Never leave money on the table",
    ],
    useCases: [
      "Weekend and holiday rate optimization",
      "Last-minute discount automation",
      "Event-based pricing (festivals, races)",
      "Length-of-stay discounts",
    ],
    testimonials: [
      {
        quote:
          "Dynamic pricing increased our revenue by 22% last season while maintaining high occupancy.",
        author: "Mike T.",
        role: "General Manager",
        campground: "Lakeside Campground",
      },
    ],
  },
  "pos-system": {
    feature: "Point of Sale",
    slug: "pos-system",
    title: "Campground POS System - Store, Activities & More",
    description:
      "Integrated point of sale for your camp store, activities, and amenities. One system for everything.",
    benefits: [
      "Unified reporting across reservations and retail",
      "Charge to site for guest convenience",
      "Inventory tracking and reorder alerts",
      "Activity booking and equipment rental",
      "Gift cards and loyalty integration",
    ],
    useCases: [
      "Camp store and snack bar",
      "Kayak and bike rentals",
      "Firewood and ice sales",
      "Activity and tour bookings",
    ],
    testimonials: [
      {
        quote:
          "Having POS integrated with reservations saves us hours every week. Guests love charging to their site.",
        author: "Jennifer L.",
        role: "Operations Manager",
        campground: "Mountain View RV Park",
      },
    ],
  },
  "staff-scheduling": {
    feature: "Staff Scheduling",
    slug: "staff-scheduling",
    title: "Campground Staff Scheduling Software",
    description:
      "Schedule your team efficiently with built-in staff management. Shifts, availability, and time tracking.",
    benefits: [
      "Create schedules in minutes, not hours",
      "Staff can swap shifts with approval",
      "Automatic overtime and coverage alerts",
      "Mobile app for staff to check schedules",
      "Integrated with payroll export",
    ],
    useCases: [
      "Seasonal staff management",
      "Front desk coverage",
      "Housekeeping schedules",
      "Maintenance crew coordination",
    ],
    testimonials: [
      {
        quote: "Staff scheduling used to take me 4 hours a week. Now it's 30 minutes.",
        author: "David R.",
        role: "Owner",
        campground: "Sunny Acres Campground",
      },
    ],
  },
  "loyalty-program": {
    feature: "Loyalty Program",
    slug: "loyalty-program",
    title: "Campground Loyalty & Rewards Program",
    description: "Build guest loyalty and drive repeat bookings with a branded rewards program.",
    benefits: [
      "Increase repeat bookings by 40%",
      "Build a database of loyal guests",
      "Automated rewards and perks",
      "Birthday and anniversary recognition",
      "Referral rewards for word-of-mouth",
    ],
    useCases: [
      "Earn points on stays and purchases",
      "Tier-based member benefits",
      "Early access to popular dates",
      "Member-only discounts",
    ],
    testimonials: [
      {
        quote:
          "Our loyalty program has 1,200 members in the first year. Repeat bookings are up 45%.",
        author: "Lisa K.",
        role: "Marketing Director",
        campground: "Desert Oasis RV Resort",
      },
    ],
  },
};

@Injectable()
export class SoftwarePagesService {
  private readonly logger = new Logger(SoftwarePagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a software page by slug from the database
   */
  async getPageBySlug(slug: string): Promise<SoftwarePageData | null> {
    const page = await this.prisma.softwarePage.findUnique({
      where: { slug },
    });

    if (!page || !page.isPublished) {
      return null;
    }

    const content = coerceRecord(page.content);
    const heroHeadline = getString(content.heroHeadline) ?? page.title;
    const heroSubheadline = getString(content.heroSubheadline) ?? null;

    return {
      id: page.id,
      slug: page.slug,
      pageType: page.type,
      title: page.title,
      metaTitle: page.metaTitle || page.title,
      metaDescription: page.metaDescription || "",
      heroHeadline,
      heroSubheadline,
      content,
      isPublished: page.isPublished,
      publishedAt: page.publishedAt,
    };
  }

  /**
   * Get competitor comparison data
   */
  getCompetitorComparison(competitorSlug: string): CompetitorComparison | null {
    return COMPETITORS[competitorSlug] || null;
  }

  /**
   * List all competitors for the comparison index page
   */
  listCompetitors(): Array<{ name: string; slug: string }> {
    return Object.entries(COMPETITORS).map(([slug, data]) => ({
      name: data.competitorName,
      slug,
    }));
  }

  /**
   * Get feature page data
   */
  getFeaturePage(featureSlug: string): FeaturePageData | null {
    return FEATURE_PAGES[featureSlug] || null;
  }

  /**
   * List all feature pages
   */
  listFeaturePages(): Array<{ feature: string; slug: string; title: string }> {
    return Object.values(FEATURE_PAGES).map((f) => ({
      feature: f.feature,
      slug: f.slug,
      title: f.title,
    }));
  }

  /**
   * Create or update a software page in the database
   */
  async upsertPage(data: {
    slug: string;
    pageType: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;
    heroHeadline: string;
    heroSubheadline?: string;
    content: unknown;
    isPublished?: boolean;
  }): Promise<SoftwarePageData> {
    const mergedContent = {
      ...coerceRecord(data.content),
      heroHeadline: data.heroHeadline,
      heroSubheadline: data.heroSubheadline ?? null,
    };
    const content = toJsonValue(mergedContent) ?? {};
    const publishedAt = data.isPublished ? new Date() : null;
    const now = new Date();

    const page = await this.prisma.softwarePage.upsert({
      where: { slug: data.slug },
      update: {
        type: data.pageType,
        title: data.title,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        content,
        isPublished: data.isPublished ?? true,
        publishedAt,
        updatedAt: now,
      },
      create: {
        id: randomUUID(),
        slug: data.slug,
        type: data.pageType,
        title: data.title,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        content,
        isPublished: data.isPublished ?? false,
        publishedAt,
        updatedAt: now,
      },
    });

    const pageContent = coerceRecord(page.content);
    const heroHeadline = getString(pageContent.heroHeadline) ?? page.title;
    const heroSubheadline = getString(pageContent.heroSubheadline) ?? null;

    return {
      id: page.id,
      slug: page.slug,
      pageType: page.type,
      title: page.title,
      metaTitle: page.metaTitle || page.title,
      metaDescription: page.metaDescription || "",
      heroHeadline,
      heroSubheadline,
      content: pageContent,
      isPublished: page.isPublished,
      publishedAt: page.publishedAt,
    };
  }

  /**
   * Seed initial software pages
   */
  async seedSoftwarePages(): Promise<number> {
    let created = 0;

    // Create competitor comparison pages
    for (const [slug, competitor] of Object.entries(COMPETITORS)) {
      await this.upsertPage({
        slug: `vs-${slug}`,
        pageType: "competitor_comparison",
        title: `Keepr vs ${competitor.competitorName}`,
        metaTitle: `${competitor.competitorName} Alternative | Keepr vs ${competitor.competitorName}`,
        metaDescription: `Looking for a ${competitor.competitorName} alternative? Compare Keepr vs ${competitor.competitorName} features, pricing, and see why campgrounds are switching.`,
        heroHeadline: `Looking for a ${competitor.competitorName} Alternative?`,
        heroSubheadline: `See how Keepr compares and why campgrounds are making the switch`,
        content: competitor,
        isPublished: true,
      });
      created++;
    }

    // Create feature pages
    for (const feature of Object.values(FEATURE_PAGES)) {
      await this.upsertPage({
        slug: `features/${feature.slug}`,
        pageType: "feature",
        title: feature.title,
        metaTitle: `${feature.title} | Keepr`,
        metaDescription: feature.description,
        heroHeadline: feature.title,
        heroSubheadline: feature.description,
        content: feature,
        isPublished: true,
      });
      created++;
    }

    this.logger.log(`Seeded ${created} software pages`);
    return created;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};
