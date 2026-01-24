"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient, type LeadRecord } from "@/lib/api-client";
import { useWhoami } from "@/hooks/use-whoami";

export default function MarketingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: whoami } = useWhoami();
  const [selectedCampground, setSelectedCampground] = useState<string>("");

  const campgroundOptions = useMemo(() => {
    const options: { id: string; name: string }[] = [
      { id: "public-site", name: "Public site (demo)" },
    ];
    const memberships = whoami?.user?.memberships || [];
    memberships.forEach((membership) => {
      if (!options.some((opt) => opt.id === membership.campgroundId)) {
        options.push({
          id: membership.campgroundId,
          name: membership.campground?.name || membership.campgroundId,
        });
      }
    });
    return options;
  }, [whoami]);

  useEffect(() => {
    if (selectedCampground) return;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) {
      setSelectedCampground(stored);
      return;
    }
    if (campgroundOptions.length > 0) {
      setSelectedCampground(campgroundOptions[0].id);
    }
  }, [selectedCampground, campgroundOptions]);

  useEffect(() => {
    if (selectedCampground && typeof window !== "undefined") {
      localStorage.setItem("campreserv:selectedCampground", selectedCampground);
    }
  }, [selectedCampground]);

  const leadsQuery = useQuery({
    queryKey: ["leads", selectedCampground],
    queryFn: () => apiClient.listLeads(selectedCampground),
    enabled: !!selectedCampground,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadRecord["status"] }) =>
      apiClient.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", selectedCampground] });
      toast({ title: "Status updated", description: "Lead status updated internally." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Update failed. Try again.";
      toast({ title: "Update failed", description: message });
    },
  });

  const syncLead = useMutation({
    mutationFn: (id: string) => apiClient.syncLeadToCrm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", selectedCampground] });
      toast({ title: "Sync simulated", description: "Kept internal — no CRM calls were made." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Sync failed. Try again.";
      toast({ title: "Sync failed", description: message });
    },
  });

  const leads: LeadRecord[] = leadsQuery.data || [];

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : "Not yet";

  const statusOptions: { value: LeadRecord["status"]; label: string }[] = [
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
  ];

  const isLeadStatus = (value: string): value is LeadRecord["status"] =>
    value === "new" || value === "contacted" || value === "qualified";

  return (
    <DashboardShell>
      <div className="grid gap-4">
        <div className="card p-6 space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Marketing & web</h1>
          <p className="text-muted-foreground text-sm">
            Public campground pages are live with SEO/meta, sitemap, and lead capture hooks. Keep
            promos and campaigns aligned.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="text-sm font-semibold text-foreground">Public site</div>
              <div className="text-xs text-muted-foreground mt-1">
                Campground detail pages include photos, amenities, events, SEO/meta tags, sitemap,
                and robots coverage.
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Configure analytics (GA4, Meta Pixel) in Settings → Analytics & Tracking; pages
                honor canonical base URL.
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="text-sm font-semibold text-foreground">Promotions & campaigns</div>
              <div className="text-xs text-muted-foreground mt-1">
                Create promo codes, set usage windows/limits, and keep them in sync with booking
                flows.
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Email campaigns live in Settings → Campaigns; promos integrate with admin/public
                booking and OTA-safe pricing.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/settings/promotions">
              <Button size="sm">Manage promotions</Button>
            </Link>
            <Link href="/settings/campaigns">
              <Button size="sm" variant="secondary">
                Open campaigns
              </Button>
            </Link>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Leads (internal only)</h2>
              <p className="text-sm text-muted-foreground">
                Captured from landing pages and admin forms. Stored per campground with a stubbed
                “sync to CRM” path.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                value={selectedCampground}
                onChange={(e) => setSelectedCampground(e.target.value)}
              >
                {campgroundOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["leads", selectedCampground] })
                }
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            No external CRM calls. “Sync now” simply marks the lead as synced and timestamps it.
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium text-foreground">{lead.name}</TableCell>
                    <TableCell className="text-foreground">{lead.email}</TableCell>
                    <TableCell className="text-foreground">{lead.interest}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={(value) => {
                          if (isLeadStatus(value)) {
                            updateStatus.mutate({ id: lead.id, status: value });
                          }
                        }}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.source || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(lead.lastSyncedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={syncLead.isPending}
                        onClick={() => syncLead.mutate(lead.id)}
                      >
                        {lead.lastSyncedAt
                          ? syncLead.isPending
                            ? "Syncing..."
                            : "Resync"
                          : "Sync now"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {leadsQuery.isLoading && (
              <div className="text-center text-sm text-muted-foreground py-8">Loading leads…</div>
            )}
            {!leadsQuery.isLoading && leads.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No leads yet for this campground.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
