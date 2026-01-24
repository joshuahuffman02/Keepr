"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { ProductList } from "../../components/store/ProductList";
import { CategoryList } from "../../components/store/CategoryList";
import { AddOnList } from "../../components/store/AddOnList";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";

export default function StorePage() {
  const [selectedCg, setSelectedCg] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "addons">("products");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });

  const summaryQuery = useQuery({
    queryKey: ["store-order-summary", selectedCg, startDate, endDate],
    queryFn: () => apiClient.getStoreOrderSummary(selectedCg, { start: startDate, end: endDate }),
    enabled: !!selectedCg,
  });

  const formatMoney = (cents?: number | null) =>
    typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "—";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) {
      setSelectedCg(stored);
    } else if (campgrounds.length > 0) {
      setSelectedCg(campgrounds[0].id);
    }
  }, [campgrounds]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Management</h1>
          <p className="text-muted-foreground">
            Manage your inventory, product categories, and add-on services.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">POS setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-status-success" />
              <div>Configure tax rules and GL codes for store items.</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-status-success" />
              <div>
                Set store hours / fulfillment defaults (pickup, delivery, curbside) in settings.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-status-success" />
              <div>Allocate inventory by channel (POS vs online) and buffers on each product.</div>
            </div>
          </CardContent>
        </Card>

        {selectedCg && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">POS/Store mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="store-summary-start"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    Start
                  </Label>
                  <Input
                    id="store-summary-start"
                    type="date"
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="store-summary-end"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    End
                  </Label>
                  <Input
                    id="store-summary-end"
                    type="date"
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => summaryQuery.refetch()}
                    disabled={summaryQuery.isFetching}
                  >
                    {summaryQuery.isFetching ? "Refreshing…" : "Apply"}
                  </button>
                  <button
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      const d = new Date();
                      const today = d.toISOString().slice(0, 10);
                      setStartDate(today);
                      setEndDate(today);
                    }}
                    disabled={summaryQuery.isFetching}
                  >
                    Today
                  </button>
                </div>
                {summaryQuery.data?.averages && (
                  <div className="ml-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      Avg planned:{" "}
                      {summaryQuery.data.averages.prepMinutesPlanned
                        ? `${summaryQuery.data.averages.prepMinutesPlanned.toFixed(1)} min`
                        : "—"}
                    </Badge>
                    <Badge variant="outline">
                      Avg actual:{" "}
                      {summaryQuery.data.averages.prepMinutesActual
                        ? `${summaryQuery.data.averages.prepMinutesActual.toFixed(1)} min`
                        : "—"}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">By channel</div>
                  {summaryQuery.isLoading && <div className="text-muted-foreground">Loading…</div>}
                  {!summaryQuery.isLoading && summaryQuery.data?.byChannel?.length === 0 && (
                    <div className="text-muted-foreground">No orders yet.</div>
                  )}
                  {summaryQuery.data?.byChannel?.map((row, idx) => (
                    <div
                      key={`${row.channel ?? "unknown"}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-medium text-foreground">
                        {row.channel ?? "unknown"}
                      </span>
                      <span className="text-foreground">
                        {row._count._all} · {formatMoney(row._sum.totalCents)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">By fulfillment</div>
                  {summaryQuery.isLoading && <div className="text-muted-foreground">Loading…</div>}
                  {!summaryQuery.isLoading && summaryQuery.data?.byFulfillment?.length === 0 && (
                    <div className="text-muted-foreground">No orders yet.</div>
                  )}
                  {summaryQuery.data?.byFulfillment?.map((row, idx) => (
                    <div
                      key={`${row.fulfillmentType ?? "unknown"}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-medium text-foreground">
                        {row.fulfillmentType ?? "unknown"}
                      </span>
                      <span className="text-foreground">
                        {row._count._all} · {formatMoney(row._sum.totalCents)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">By status</div>
                  {summaryQuery.isLoading && <div className="text-muted-foreground">Loading…</div>}
                  {!summaryQuery.isLoading && summaryQuery.data?.byStatus?.length === 0 && (
                    <div className="text-muted-foreground">No orders yet.</div>
                  )}
                  {summaryQuery.data?.byStatus?.map((row, idx) => (
                    <div
                      key={`${row.status ?? "unknown"}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{row.status ?? "unknown"}</span>
                      <span className="text-foreground">
                        {row._count._all} · {formatMoney(row._sum.totalCents)}
                      </span>
                    </div>
                  ))}
                </div>

                {summaryQuery.data?.averagesByFulfillment?.length ? (
                  <div className="md:col-span-3 space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">
                      Avg ready time by fulfillment
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {summaryQuery.data.averagesByFulfillment.map((row, idx) => (
                        <div
                          key={`${row.fulfillmentType ?? "unknown"}-${idx}`}
                          className="rounded-md border border-border px-3 py-2 flex items-center justify-between"
                        >
                          <span className="font-medium text-foreground">
                            {row.fulfillmentType ?? "unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground space-x-2">
                            <Badge variant="outline">
                              Planned:{" "}
                              {row.prepMinutesPlanned
                                ? `${row.prepMinutesPlanned.toFixed(1)} min`
                                : "—"}
                            </Badge>
                            <Badge variant="outline">
                              Actual:{" "}
                              {row.prepMinutesActual
                                ? `${row.prepMinutesActual.toFixed(1)} min`
                                : "—"}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedCg ? (
          <div className="space-y-4">
            <div className="border-b border-border">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab("products")}
                  aria-pressed={activeTab === "products"}
                  className={cn(
                    activeTab === "products"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium",
                  )}
                >
                  Products
                </button>
                <button
                  onClick={() => setActiveTab("categories")}
                  aria-pressed={activeTab === "categories"}
                  className={cn(
                    activeTab === "categories"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium",
                  )}
                >
                  Categories
                </button>
                <button
                  onClick={() => setActiveTab("addons")}
                  aria-pressed={activeTab === "addons"}
                  className={cn(
                    activeTab === "addons"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium",
                  )}
                >
                  Add-ons
                </button>
              </nav>
            </div>

            <div className="min-h-[400px]">
              {activeTab === "products" && <ProductList campgroundId={selectedCg} />}
              {activeTab === "categories" && <CategoryList campgroundId={selectedCg} />}
              {activeTab === "addons" && <AddOnList campgroundId={selectedCg} />}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Please select a campground to manage store items.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
