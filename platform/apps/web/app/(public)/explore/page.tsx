"use client";

import { useState, useEffect } from "react";
import { CampgroundSearchMap, SearchableCampground } from "@/components/maps/CampgroundSearchMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tent, MapPin, Star, Filter, List, Map } from "lucide-react";
import Link from "next/link";

// Demo data - in production this would come from the API
const DEMO_CAMPGROUNDS: SearchableCampground[] = [
  {
    id: "1",
    name: "Yosemite Pines RV Resort",
    slug: "yosemite-pines",
    latitude: 37.7456,
    longitude: -119.5936,
    city: "Groveland",
    state: "CA",
    rating: 4.8,
    reviewCount: 342,
    priceFrom: 55,
    amenities: ["rv", "tent", "lake", "forest"],
    siteTypes: ["rv", "tent", "cabin"],
    isOpen: true,
  },
  {
    id: "2",
    name: "Grand Canyon Campground",
    slug: "grand-canyon",
    latitude: 36.0544,
    longitude: -112.1401,
    city: "Grand Canyon",
    state: "AZ",
    rating: 4.9,
    reviewCount: 567,
    priceFrom: 45,
    amenities: ["tent", "mountain"],
    siteTypes: ["tent", "rv"],
    isOpen: true,
  },
  {
    id: "3",
    name: "Zion River Resort",
    slug: "zion-river",
    latitude: 37.2043,
    longitude: -113.0263,
    city: "Virgin",
    state: "UT",
    rating: 4.7,
    reviewCount: 289,
    priceFrom: 65,
    amenities: ["rv", "glamping", "river"],
    siteTypes: ["rv", "glamping", "cabin"],
    isOpen: true,
  },
  {
    id: "4",
    name: "Yellowstone Grizzly RV Park",
    slug: "yellowstone-grizzly",
    latitude: 44.6618,
    longitude: -111.1048,
    city: "West Yellowstone",
    state: "MT",
    rating: 4.6,
    reviewCount: 423,
    priceFrom: 75,
    amenities: ["rv", "forest"],
    siteTypes: ["rv"],
    isOpen: true,
  },
  {
    id: "5",
    name: "Myrtle Beach Travel Park",
    slug: "myrtle-beach",
    latitude: 33.7096,
    longitude: -78.8686,
    city: "Myrtle Beach",
    state: "SC",
    rating: 4.5,
    reviewCount: 612,
    priceFrom: 85,
    amenities: ["rv", "beach", "sunny"],
    siteTypes: ["rv", "cabin"],
    isOpen: true,
  },
  {
    id: "6",
    name: "Acadia East Campground",
    slug: "acadia-east",
    latitude: 44.3386,
    longitude: -68.2733,
    city: "Bar Harbor",
    state: "ME",
    rating: 4.8,
    reviewCount: 178,
    priceFrom: 40,
    amenities: ["tent", "forest", "lake"],
    siteTypes: ["tent"],
    isOpen: true,
  },
  {
    id: "7",
    name: "Everglades Holiday Park",
    slug: "everglades-holiday",
    latitude: 26.0579,
    longitude: -80.4413,
    city: "Fort Lauderdale",
    state: "FL",
    rating: 4.4,
    reviewCount: 234,
    priceFrom: 50,
    amenities: ["rv", "tent", "water"],
    siteTypes: ["rv", "tent"],
    isOpen: true,
  },
  {
    id: "8",
    name: "Big Sur Campground",
    slug: "big-sur",
    latitude: 36.2704,
    longitude: -121.8081,
    city: "Big Sur",
    state: "CA",
    rating: 4.9,
    reviewCount: 445,
    priceFrom: 60,
    amenities: ["tent", "forest", "beach"],
    siteTypes: ["tent", "cabin"],
    isOpen: true,
  },
  {
    id: "9",
    name: "Glacier National Park KOA",
    slug: "glacier-koa",
    latitude: 48.5053,
    longitude: -113.9881,
    city: "West Glacier",
    state: "MT",
    rating: 4.7,
    reviewCount: 312,
    priceFrom: 70,
    amenities: ["rv", "tent", "mountain", "lake"],
    siteTypes: ["rv", "tent", "cabin"],
    isOpen: true,
  },
  {
    id: "10",
    name: "Joshua Tree Lake RV Park",
    slug: "joshua-tree-lake",
    latitude: 34.1347,
    longitude: -116.3131,
    city: "Joshua Tree",
    state: "CA",
    rating: 4.3,
    reviewCount: 156,
    priceFrom: 45,
    amenities: ["rv", "tent", "sunny"],
    siteTypes: ["rv", "tent"],
    isOpen: true,
  },
];

type ViewMode = "map" | "list";

export default function ExplorePage() {
  const [campgrounds, setCampgrounds] = useState<SearchableCampground[]>(DEMO_CAMPGROUNDS);
  const [selectedCampground, setSelectedCampground] = useState<SearchableCampground | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [visibleBounds, setVisibleBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  const handleSelectCampground = (campground: SearchableCampground) => {
    setSelectedCampground(campground);
  };

  const handleBoundsChange = (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    setVisibleBounds(bounds);
    // In production, you would fetch campgrounds within these bounds from the API
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <Tent className="h-6 w-6 text-emerald-600" />
                <span className="font-bold text-xl">Keepr</span>
              </Link>
              <Badge variant="secondary">Explore</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("map")}
              >
                <Map className="h-4 w-4 mr-1" />
                Map
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Explore Campgrounds</h1>
          <p className="text-slate-600 mt-1">
            Discover {campgrounds.length} amazing campgrounds across the country
          </p>
        </div>

        {viewMode === "map" ? (
          <div className="rounded-xl overflow-hidden shadow-lg border">
            <CampgroundSearchMap
              campgrounds={campgrounds}
              onSelectCampground={handleSelectCampground}
              onBoundsChange={handleBoundsChange}
              height="calc(100vh - 250px)"
              showSearch={true}
              showFilters={true}
              showUserLocation={true}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campgrounds.map((campground) => (
              <div
                key={campground.id}
                className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="h-40 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Tent className="h-16 w-16 text-white/50" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-900">{campground.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                    <MapPin className="h-3 w-3" />
                    {campground.city}, {campground.state}
                  </div>
                  {campground.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{campground.rating.toFixed(1)}</span>
                      <span className="text-sm text-slate-500">
                        ({campground.reviewCount} reviews)
                      </span>
                    </div>
                  )}
                  {campground.amenities && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {campground.amenities.slice(0, 4).map((amenity) => (
                        <Badge key={amenity} variant="secondary" className="text-xs capitalize">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    {campground.priceFrom && (
                      <p className="text-lg font-bold text-emerald-600">
                        ${campground.priceFrom}
                        <span className="text-sm font-normal text-slate-500">/night</span>
                      </p>
                    )}
                    <Button size="sm">Book Now</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
