/**
 * Structured Data (JSON-LD) Generators
 * Schema.org structured data for rich search results
 */

import { SEO_CONFIG, getBaseUrl } from "./constants";

/**
 * Organization schema for the company
 */
export function generateOrganizationSchema() {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_CONFIG.siteName,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: [`https://x.com/${SEO_CONFIG.twitterHandle.replace("@", "")}`],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "support@keeprstay.com",
    },
  };
}

/**
 * Website schema for search engine features
 */
export function generateWebsiteSchema() {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_CONFIG.siteName,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

/**
 * FAQ schema for FAQ pages
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/**
 * SoftwareApplication schema for the platform
 */
export function generateSoftwareSchema() {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SEO_CONFIG.siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free trial available",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "50",
    },
    url: baseUrl,
    description: SEO_CONFIG.defaultDescription,
  };
}

/**
 * Campground/LodgingBusiness schema
 */
export function generateCampgroundSchema(campground: {
  name: string;
  slug: string;
  description?: string | null;
  tagline?: string | null;
  heroImageUrl?: string | null;
  photos?: string[] | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone?: string | null;
  email?: string | null;
  reviewScore?: number | null;
  reviewCount?: number | null;
  amenities?: string[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  priceRange?: string | null;
}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/park/${campground.slug}`;

  const images = campground.heroImageUrl
    ? [campground.heroImageUrl, ...(campground.photos || [])]
    : campground.photos || [];

  return {
    "@context": "https://schema.org",
    "@type": ["Campground", "LodgingBusiness"],
    name: campground.name,
    description: campground.description || campground.tagline,
    url,
    image: images.length ? images : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: campground.address1,
      addressLocality: campground.city,
      addressRegion: campground.state,
      postalCode: campground.postalCode,
      addressCountry: campground.country || "US",
    },
    geo:
      campground.latitude && campground.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: Number(campground.latitude),
            longitude: Number(campground.longitude),
          }
        : undefined,
    telephone: campground.phone,
    email: campground.email,
    aggregateRating:
      campground.reviewScore && campground.reviewCount
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(campground.reviewScore),
            reviewCount: campground.reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    amenityFeature: campground.amenities?.map((amenity) => ({
      "@type": "LocationFeatureSpecification",
      name: amenity,
      value: true,
    })),
    checkinTime: campground.checkInTime,
    checkoutTime: campground.checkOutTime,
    priceRange: campground.priceRange,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/book`,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: {
        "@type": "LodgingReservation",
        name: `Reservation at ${campground.name}`,
      },
    },
  };
}

/**
 * Local Business schema for campground listings
 */
export function generateLocalBusinessSchema(business: {
  name: string;
  description?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  geo?: { lat: number; lng: number };
  phone?: string;
  url: string;
  image?: string;
  priceRange?: string;
  openingHours?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description,
    url: business.url,
    image: business.image,
    telephone: business.phone,
    priceRange: business.priceRange,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      addressRegion: business.address.state,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country || "US",
    },
    geo: business.geo
      ? {
          "@type": "GeoCoordinates",
          latitude: business.geo.lat,
          longitude: business.geo.lng,
        }
      : undefined,
    openingHoursSpecification: business.openingHours?.map((hours) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: hours,
    })),
  };
}

/**
 * Article schema for blog posts
 */
export function generateArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  image?: string;
  author?: string;
  publishedAt: string;
  modifiedAt?: string;
  category?: string;
}) {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: article.url,
    image: article.image,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt || article.publishedAt,
    author: {
      "@type": "Person",
      name: article.author || "Keepr Team",
    },
    publisher: {
      "@type": "Organization",
      name: SEO_CONFIG.siteName,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo.png`,
      },
    },
    articleSection: article.category,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": article.url,
    },
  };
}

/**
 * Event schema for campground events
 */
export function generateEventSchema(event: {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
  };
  image?: string;
  url: string;
  price?: number;
  currency?: string;
  organizer?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.location.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.location.address,
        addressLocality: event.location.city,
        addressRegion: event.location.state,
      },
    },
    image: event.image,
    url: event.url,
    offers:
      event.price !== undefined
        ? {
            "@type": "Offer",
            price: event.price.toFixed(2),
            priceCurrency: event.currency || "USD",
            availability: "https://schema.org/InStock",
            url: event.url,
          }
        : undefined,
    organizer: event.organizer
      ? {
          "@type": "Organization",
          name: event.organizer,
        }
      : undefined,
  };
}

/**
 * Product schema for store items
 */
export function generateProductSchema(product: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  price: number;
  currency?: string;
  sku?: string;
  brand?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  rating?: { value: number; count: number };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    url: product.url,
    sku: product.sku,
    brand: product.brand
      ? {
          "@type": "Brand",
          name: product.brand,
        }
      : undefined,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: product.currency || "USD",
      availability: `https://schema.org/${product.availability || "InStock"}`,
      url: product.url,
    },
    aggregateRating: product.rating
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating.value,
          reviewCount: product.rating.count,
        }
      : undefined,
  };
}

/**
 * HowTo schema for tutorial/guide content
 */
export function generateHowToSchema(howTo: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration format (e.g., "PT30M")
  estimatedCost?: { value: number; currency?: string };
  image?: string;
  steps: Array<{
    name: string;
    text: string;
    image?: string;
    url?: string;
  }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    estimatedCost: howTo.estimatedCost
      ? {
          "@type": "MonetaryAmount",
          value: howTo.estimatedCost.value,
          currency: howTo.estimatedCost.currency || "USD",
        }
      : undefined,
    image: howTo.image,
    step: howTo.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image,
      url: step.url,
    })),
  };
}
