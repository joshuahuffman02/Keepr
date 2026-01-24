/**
 * Metadata Generation Utilities
 * Helpers for generating consistent, SEO-optimized metadata across pages
 */

import { Metadata } from "next";
import { SEO_CONFIG, getBaseUrl, PAGE_SEO } from "./constants";

interface MetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string | { url: string; width?: number; height?: number; alt?: string };
  noIndex?: boolean;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  type?: "website" | "article";
}

/**
 * Generate consistent metadata for any page
 */
export function generatePageMetadata(options: MetadataOptions = {}): Metadata {
  const baseUrl = getBaseUrl();
  const {
    title,
    description = SEO_CONFIG.defaultDescription,
    path = "",
    image,
    noIndex = false,
    keywords = [],
    publishedTime,
    modifiedTime,
    authors,
    type = "website",
  } = options;

  const canonical = `${baseUrl}${path}`;
  const fullTitle = title || SEO_CONFIG.defaultTitle;
  const allKeywords = [...SEO_CONFIG.keywords, ...keywords];

  // Handle image configuration
  const imageConfig =
    typeof image === "string"
      ? {
          url: image.startsWith("http") ? image : `${baseUrl}${image}`,
          width: 1200,
          height: 630,
          alt: fullTitle,
        }
      : image
        ? { ...image, url: image.url.startsWith("http") ? image.url : `${baseUrl}${image.url}` }
        : { url: `${baseUrl}/og-image.png`, width: 1200, height: 630, alt: SEO_CONFIG.siteName };

  const twitterImageConfig = image
    ? { ...imageConfig, alt: imageConfig.alt || fullTitle }
    : { url: `${baseUrl}/twitter-image.png`, width: 1200, height: 600, alt: SEO_CONFIG.siteName };

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: allKeywords,
    authors: authors?.map((name) => ({ name })),
    alternates: {
      canonical,
    },
    openGraph: {
      type,
      locale: SEO_CONFIG.locale,
      url: canonical,
      siteName: SEO_CONFIG.siteName,
      title: fullTitle,
      description,
      images: [imageConfig],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      site: SEO_CONFIG.twitterHandle,
      creator: SEO_CONFIG.twitterHandle,
      title: fullTitle,
      description,
      images: [twitterImageConfig],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };

  return metadata;
}

/**
 * Get predefined metadata for a static page path
 */
export function getStaticPageMetadata(path: string): Metadata {
  const pageSeo = PAGE_SEO[path];
  if (!pageSeo) {
    return generatePageMetadata({ path });
  }
  return generatePageMetadata({
    title: pageSeo.title,
    description: pageSeo.description,
    keywords: pageSeo.keywords,
    path,
  });
}

/**
 * Generate metadata for a campground page (programmatic SEO)
 */
export function generateCampgroundMetadata(campground: {
  name: string;
  slug: string;
  description?: string | null;
  tagline?: string | null;
  heroImageUrl?: string | null;
  photos?: string[] | null;
  city?: string | null;
  state?: string | null;
  reviewScore?: number | null;
  reviewCount?: number | null;
  siteTypes?: string[];
}): Metadata {
  const baseUrl = getBaseUrl();
  const canonical = `${baseUrl}/park/${campground.slug}`;

  // Build SEO-optimized description
  const location = [campground.city, campground.state].filter(Boolean).join(", ");
  const baseDescription = campground.description || campground.tagline || "";
  const seoDescription = baseDescription
    ? `${baseDescription.slice(0, 150)}${baseDescription.length > 150 ? "..." : ""}`
    : `Book your stay at ${campground.name}${location ? ` in ${location}` : ""}. Reserve campsites, cabins, and RV spots online.`;

  // Build SEO-optimized title with location
  const titleParts = [campground.name];
  if (location) titleParts.push(location);
  titleParts.push("Camping & RV");
  const seoTitle = titleParts.join(" | ");

  // Get best available image
  const images = campground.heroImageUrl
    ? [campground.heroImageUrl, ...(campground.photos || [])]
    : campground.photos || [];

  // Generate keywords based on campground data
  const keywords = [
    campground.name,
    `${campground.name} camping`,
    `${campground.name} reservations`,
    ...(campground.city ? [`camping ${campground.city}`, `RV parks ${campground.city}`] : []),
    ...(campground.state ? [`camping ${campground.state}`, `campgrounds ${campground.state}`] : []),
    ...(campground.siteTypes || []).map((type) => `${type} camping`),
  ].filter(Boolean);

  return {
    title: seoTitle,
    description: seoDescription,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: SEO_CONFIG.locale,
      url: canonical,
      siteName: SEO_CONFIG.siteName,
      title: seoTitle,
      description: seoDescription,
      images: images.length
        ? images.slice(0, 4).map((url) => ({ url, width: 1200, height: 630, alt: campground.name }))
        : [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630, alt: SEO_CONFIG.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      site: SEO_CONFIG.twitterHandle,
      title: seoTitle,
      description: seoDescription,
      images: images[0] || `${baseUrl}/twitter-image.png`,
    },
    robots: { index: true, follow: true, "max-image-preview": "large" },
  };
}

/**
 * Generate metadata for blog/article pages
 */
export function generateArticleMetadata(article: {
  title: string;
  slug: string;
  excerpt?: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
}): Metadata {
  const baseUrl = getBaseUrl();
  const canonical = `${baseUrl}/blog/${article.category ? `${article.category}/` : ""}${article.slug}`;

  return generatePageMetadata({
    title: `${article.title} | Keepr Blog`,
    description: article.excerpt || `Read ${article.title} on the Keepr blog.`,
    path: `/blog/${article.category ? `${article.category}/` : ""}${article.slug}`,
    image: article.image,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: article.author ? [article.author] : undefined,
    keywords: article.tags,
  });
}
