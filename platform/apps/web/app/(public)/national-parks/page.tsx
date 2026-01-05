import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Mountain, MapPin, Tent } from "lucide-react";
import { getServerApiUrl } from "@/lib/api-base";

export const metadata: Metadata = {
  title: "National Parks Camping Guide | Keepr",
  description: "Explore campgrounds near America's national parks and plan your next adventure.",
  openGraph: {
    title: "National Parks Camping Guide | Keepr",
    description: "Explore campgrounds near America's national parks and plan your next adventure.",
    type: "website",
  },
};

interface NationalPark {
  name: string;
  slug: string;
  type: string;
  state: string | null;
  campgroundCount: number;
  heroImageUrl: string | null;
}

async function getNationalParks(): Promise<NationalPark[]> {
  try {
    const url = getServerApiUrl("/public/attractions/type/national-parks");
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function NationalParksPage() {
  const parks = await getNationalParks();

  return (
    <div className="min-h-screen bg-keepr-off-white">
      <section className="relative pb-24 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-sm font-semibold mb-6">
            <Mountain className="h-4 w-4" />
            National Parks
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Campgrounds near America&apos;s greatest parks
          </h1>
          <p className="text-lg md:text-xl text-emerald-100 max-w-2xl mx-auto">
            Browse iconic destinations and discover nearby campgrounds with verified reviews.
          </p>
        </div>
      </section>

      <section className="-mt-10 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {parks.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
              National park listings are coming soon. Check back shortly.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {parks.map((park) => (
                <Link
                  key={park.slug}
                  href={`/near/${park.slug}`}
                  className="group relative rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {park.heroImageUrl ? (
                      <Image
                        src={park.heroImageUrl}
                        alt={park.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-emerald-600" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className="p-5 space-y-2">
                    <h2 className="text-xl font-semibold text-foreground group-hover:text-keepr-evergreen transition-colors">
                      {park.name}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{park.state || "United States"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tent className="h-4 w-4" />
                      <span>{park.campgroundCount} campgrounds nearby</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
