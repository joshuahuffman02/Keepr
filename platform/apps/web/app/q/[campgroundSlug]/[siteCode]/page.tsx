"use client";

import { useEffect, useState } from "react";
import { apiClient as ApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Wifi, ArrowRight, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

type PublicSiteResponse = Awaited<ReturnType<typeof ApiClient.getPublicSite>>;

export default function QrSitePage({
  params,
}: {
  params: { campgroundSlug: string; siteCode: string };
}) {
  const [data, setData] = useState<PublicSiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingMode, setBookingMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const res = await ApiClient.getPublicSite(params.campgroundSlug, params.siteCode);
        setData(res);
      } catch (err) {
        console.error(err);
        setError("Could not load site details. Please scan again or contact the office.");
      } finally {
        setLoading(false);
      }
    };
    fetchSite();
  }, [params.campgroundSlug, params.siteCode]);

  const handleBook = () => {
    // Mock payment flow
    setBookingMode(true);
    setTimeout(() => {
      toast({
        title: "Payment Successful",
        description: "You have successfully booked this site for 1 night!",
      });
      // Reload to show occupied state
      window.location.reload();
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">{error || "Site not found"}</p>
        <Button asChild>
          <Link href={`/public/campgrounds/${params.campgroundSlug}`}>View Campground Map</Link>
        </Button>
      </div>
    );
  }

  const { site, status, currentReservation } = data;
  const isAvailable = status === "available";

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-gray-600">Site {site.name}</h1>
          <p className="text-sm text-gray-400 uppercase tracking-widest">{params.campgroundSlug}</p>
        </div>

        {/* Main Status Card */}
        <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
          <div className={`h-2 ${isAvailable ? "bg-green-500" : "bg-blue-600"}`} />
          <CardHeader className="text-center pb-2">
            <Badge
              variant={isAvailable ? "default" : "secondary"}
              className={`mx-auto mb-4 px-4 py-1 text-base ${isAvailable ? "bg-green-500 hover:bg-green-600" : ""}`}
            >
              {isAvailable ? "Available Now" : "Reserved"}
            </Badge>
            <CardTitle className="text-3xl font-bold">
              {site.siteClass?.name || "Standard Site"}
            </CardTitle>
            <CardDescription>Max occupancy: {site.maxOccupancy} guests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amenities Grid */}
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>30/50 Amp Power</span>
                {/* Mock amenities for prototype */}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Wifi className="h-4 w-4 text-blue-500" />
                <span>High-Speed WiFi</span>
              </div>
            </div>

            {isAvailable ? (
              <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                <p className="text-sm font-medium text-green-800 mb-1">Instant Book Rate</p>
                <p className="text-3xl font-bold text-green-700">
                  $45<span className="text-sm font-normal text-green-600">/night</span>
                </p>
                <p className="text-xs text-green-600 mt-2">Includes taxes & fees</p>
              </div>
            ) : (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                <p className="text-sm text-blue-800">Reserved until</p>
                <p className="font-semibold text-blue-900">
                  {currentReservation?.departureDate
                    ? new Date(currentReservation.departureDate).toLocaleDateString()
                    : "—"}
                </p>
                {/* Simple Auth Check Mock */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-xs text-blue-600 mb-2">Is this your reservation?</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full bg-white text-blue-700 hover:bg-blue-50"
                  >
                    Log In to Unlock
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-2">
            {isAvailable ? (
              <Button
                size="lg"
                className="w-full text-lg h-12 shadow-md transition-all active:scale-95"
                onClick={handleBook}
                disabled={bookingMode}
              >
                {bookingMode ? (
                  "Processing..."
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" /> Book & Power On
                  </>
                )}
              </Button>
            ) : (
              <Button variant="ghost" className="w-full text-gray-500" asChild>
                <Link href={`/public/campgrounds/${params.campgroundSlug}`}>
                  Find Another Site <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Guest Support */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Need help? Call{" "}
            <a href="tel:+15550199" className="underline">
              Front Desk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
