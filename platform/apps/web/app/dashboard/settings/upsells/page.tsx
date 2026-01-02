"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../../../../components/ui/button";
import { AddOnList } from "../../../../components/store/AddOnList";

export default function UpsellsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    const cg = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(cg);
  }, []);

  if (!campgroundId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a campground first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upsells & Add-ons</h1>
            <p className="text-muted-foreground">
              Upsells now use your Store add-ons for booking extras and guest portal offers.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/store">Manage products</Link>
          </Button>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Unified catalog</div>
          <p className="mt-1">
            Add-ons here appear in checkout and the guest portal. Inventory products and POS items live in Store.
          </p>
        </div>

        <AddOnList campgroundId={campgroundId} />
      </div>
  );
}
