"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { format, differenceInDays } from "date-fns";
import {
  MapPin,
  Calendar,
  Wifi,
  CloudSun,
  Navigation,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "../../../../components/ui/button";

export default function WelcomePacket() {
  const { id: idParam } = useParams<{ id?: string }>();
  const id = idParam ?? "";
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const {
    data: reservation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-reservation", id, token],
    queryFn: () => apiClient.getPublicReservation(id, token),
    enabled: !!id && !!token,
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Token Required</h1>
          <p className="text-slate-600">
            Please use the link provided in your email to view your welcome packet.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-emerald-600 font-medium">
          Loading your welcome packet...
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Reservation Not Found</h1>
          <p className="text-slate-600">We couldn't find the reservation you're looking for.</p>
        </div>
      </div>
    );
  }

  const daysUntil = differenceInDays(new Date(reservation.arrivalDate), new Date());
  const isToday = daysUntil === 0;
  const isPast = daysUntil < 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Section */}
      <div className="relative h-64 md:h-80 bg-slate-900">
        {reservation.site.siteClass?.photos?.[0] ? (
          <img
            src={reservation.site.siteClass.photos[0]}
            alt="Site View"
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-slate-900 opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-md mx-auto">
            <p className="text-status-success font-medium mb-1 uppercase tracking-wider text-xs">
              Welcome to {reservation.campground.name}
            </p>
            <h1 className="text-3xl font-bold mb-2">Hi, {reservation.guest.primaryFirstName}!</h1>
            <p className="text-slate-300">
              {isToday
                ? "Your adventure begins today!"
                : isPast
                  ? "We hope you enjoyed your stay!"
                  : `Your trip is in ${daysUntil} day${daysUntil === 1 ? "" : "s"}!`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-10 space-y-6">
        {/* Reservation Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Your Site</p>
              <h2 className="text-2xl font-bold text-slate-900">{reservation.site.siteNumber}</h2>
              <p className="text-sm text-slate-600">
                {reservation.site.siteClass?.name || "Standard Site"}
              </p>
            </div>
            <div className="bg-status-success/15 p-2 rounded-lg">
              <MapPin className="h-6 w-6 text-status-success" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500 mb-1">Check-in</p>
              <p className="font-semibold text-slate-900">
                {format(new Date(reservation.arrivalDate), "MMM d")}
              </p>
              <p className="text-xs text-slate-400">After 2:00 PM</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Check-out</p>
              <p className="font-semibold text-slate-900">
                {format(new Date(reservation.departureDate), "MMM d")}
              </p>
              <p className="text-xs text-slate-400">Before 11:00 AM</p>
            </div>
          </div>

          <Button className="w-full bg-status-success hover:bg-status-success/90 text-white">
            <Navigation className="h-4 w-4 mr-2" />
            Get Directions to Site
          </Button>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <Wifi className="h-6 w-6 text-status-info mb-2" />
            <h3 className="font-semibold text-slate-900 text-sm">WiFi Access</h3>
            <p className="text-xs text-slate-500 mt-1">Network: CampGuest</p>
            <p className="text-xs font-mono bg-slate-100 px-2 py-1 rounded mt-2">
              Pass: happycamper
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <CloudSun className="h-6 w-6 text-status-warning mb-2" />
            <h3 className="font-semibold text-slate-900 text-sm">Weather</h3>
            <p className="text-xs text-slate-500 mt-1">Sunny, 75°F</p>
            <p className="text-xs text-slate-400">Perfect for hiking!</p>
          </div>
        </div>

        {/* Local Guide Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Local Guide</h3>
            <ExternalLink className="h-4 w-4 text-slate-400" />
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-3">
              Explore the best trails, dining, and attractions near {reservation.campground.name}.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-status-success/15 rounded-lg flex items-center justify-center text-status-success">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Sunset Trail</p>
                  <p className="text-xs text-slate-500">1.2 miles • Easy</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-status-warning/15 rounded-lg flex items-center justify-center text-status-warning">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Rusty's BBQ</p>
                  <p className="text-xs text-slate-500">0.5 miles • $$</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <p className="text-xs text-slate-400">
            Need help? Text us at <span className="font-medium text-slate-600">555-0123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
