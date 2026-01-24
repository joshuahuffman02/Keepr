"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { HelpAnchor } from "../../components/help/HelpAnchor";

export default function ReservationsLanding() {
  const router = useRouter();
  const [selectedCg, setSelectedCg] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored && /^c[a-z0-9]{10,}$/i.test(stored)) {
      setSelectedCg(stored);
      router.replace(`/campgrounds/${stored}/reservations`);
    } else {
      setSelectedCg(null);
    }
  }, [router]);

  return (
    <DashboardShell title="Reservations" subtitle="Reservations are scoped by campground.">
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
          <HelpAnchor topicId="reservation-manage" label="How to manage reservations" />
        </div>
        <p className="text-muted-foreground text-sm">
          {selectedCg
            ? "Redirecting you to your campground…"
            : "Pick a campground to view or edit its bookings, or head to Booking to create a new one."}
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/campgrounds">Choose campground</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/booking">Create reservation</Link>
          </Button>
        </div>
      </Card>
    </DashboardShell>
  );
}
