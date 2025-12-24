import { Metadata, ResolvingMetadata } from "next";
import { apiClient } from "@/lib/api-client";
import { CampgroundV2Client } from "./client";
import Script from "next/script";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

const baseUrl = (process.env.NEXT_PUBLIC_APP_BASE || "https://campeveryday.com").replace(/\/+$/, "");

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const { token } = await searchParams;
  try {
    const campground = await apiClient.getPublicCampground(slug, token);
    const previousImages = (await parent).openGraph?.images || [];
    const canonical = `${baseUrl}/park/${slug}/v2`;
    const description = campground.description || campground.tagline || `Book your stay at ${campground.name}`;
    const images = campground.heroImageUrl
      ? [campground.heroImageUrl, ...(campground.photos || [])]
      : campground.photos || [];

    return {
      title: `${campground.name} | Book stays, events, deals`,
      description,
      alternates: { canonical },
      openGraph: {
        title: campground.name,
        description,
        url: canonical,
        images: images.length ? images : previousImages,
      },
      twitter: {
        card: "summary_large_image",
        title: campground.name,
        description,
        images: images.length ? images[0] : undefined,
      },
    };
  } catch (e) {
    return {
      title: "Campground",
    };
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token } = await searchParams;
  const initialData = await apiClient.getPublicCampground(slug, token).catch(() => null);

  const jsonLd = initialData
    ? {
        "@context": "https://schema.org",
        "@type": ["Campground", "LodgingBusiness"],
        name: initialData.name,
        description: initialData.description || initialData.tagline,
        url: `${baseUrl}/park/${slug}/v2`,
        image:
          initialData.photos && initialData.photos.length
            ? initialData.photos
            : initialData.heroImageUrl
            ? [initialData.heroImageUrl]
            : undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: initialData.address1,
          addressLocality: initialData.city,
          addressRegion: initialData.state,
          postalCode: initialData.postalCode,
          addressCountry: initialData.country,
        },
        geo:
          initialData.latitude && initialData.longitude
            ? {
                "@type": "GeoCoordinates",
                latitude: Number(initialData.latitude),
                longitude: Number(initialData.longitude),
              }
            : undefined,
        aggregateRating: initialData.reviewScore
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(initialData.reviewScore),
              reviewCount: initialData.reviewCount ?? 0,
            }
          : undefined,
        event: (initialData.events || []).map((event: any) => ({
          "@type": "Event",
          name: event.title,
          startDate: event.startDate,
          endDate: event.endDate || event.startDate,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: initialData.name,
            address: {
              "@type": "PostalAddress",
              streetAddress: initialData.address1,
              addressLocality: initialData.city,
              addressRegion: initialData.state,
              postalCode: initialData.postalCode,
              addressCountry: initialData.country,
            },
          },
          image: event.photoUrl || initialData.heroImageUrl || initialData.photos?.[0],
          description: event.description,
          offers: {
            "@type": "Offer",
            price: event.priceCents ? (event.priceCents / 100).toFixed(2) : "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: `${baseUrl}/park/${slug}/book?arrivalDate=${event.startDate?.split("T")[0]}&departureDate=${
              (event.endDate || event.startDate)?.split("T")[0]
            }`,
          },
        })),
        makesOffer: (initialData.promotions || []).map((promo: any) => ({
          "@type": "Offer",
          name: promo.code,
          description: promo.description,
          price: promo.value ? (promo.type === "percentage" ? `${promo.value}%` : (promo.value / 100).toFixed(2)) : undefined,
          priceCurrency: "USD",
          validThrough: promo.validTo,
          url: `${baseUrl}/park/${slug}/book?promoCode=${promo.code}`,
        })),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <Script id="campground-json-ld-v2" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <CampgroundV2Client slug={slug} initialData={initialData} previewToken={token} />
    </>
  );
}

