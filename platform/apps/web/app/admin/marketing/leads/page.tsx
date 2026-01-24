"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { apiClient, type LeadRecord } from "@/lib/api-client";
import { useWhoami } from "@/hooks/use-whoami";

const statusOptions: { value: LeadRecord["status"]; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
];

const statusBadge: Record<
  LeadRecord["status"],
  { label: string; variant: "secondary" | "outline" | "default" }
> = {
  new: { label: "New", variant: "secondary" },
  contacted: { label: "Contacted", variant: "outline" },
  qualified: { label: "Qualified", variant: "default" },
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "Not yet";
const getLeadStatus = (value: string): LeadRecord["status"] | null =>
  statusOptions.find((option) => option.value === value)?.value ?? null;

export default function AdminMarketingLeadsPage() {
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
    queryKey: ["admin-leads", selectedCampground],
    queryFn: () => apiClient.listLeads(selectedCampground),
    enabled: !!selectedCampground,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadRecord["status"] }) =>
      apiClient.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leads", selectedCampground] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-leads", selectedCampground] });
      toast({ title: "Sync simulated", description: "CRM sync stays stubbed — timestamp only." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Sync failed. Try again.";
      toast({ title: "Sync failed", description: message });
    },
  });

  const leads: LeadRecord[] = leadsQuery.data || [];

  const newCount = leads.filter((lead) => lead.status === "new").length;
  const contactedCount = leads.filter((lead) => lead.status === "contacted").length;
  const qualifiedCount = leads.filter((lead) => lead.status === "qualified").length;

  return (
    <div>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Admin · Marketing
            </div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Landing-form leads stay in-app. Track statuses (new, contacted, qualified) per
              campground and mark CRM sync without hitting real providers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCampground} onValueChange={setSelectedCampground}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Campground" />
              </SelectTrigger>
              <SelectContent>
                {campgroundOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["admin-leads", selectedCampground] })
              }
              disabled={!selectedCampground}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase font-semibold text-muted-foreground">New</div>
            <div className="text-2xl font-bold text-foreground">{newCount}</div>
            <p className="text-xs text-muted-foreground">
              Fresh hands-up leads waiting for outreach.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase font-semibold text-muted-foreground">Contacted</div>
            <div className="text-2xl font-bold text-foreground">{contactedCount}</div>
            <p className="text-xs text-muted-foreground">
              In-progress conversations — keep notes in interest.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase font-semibold text-muted-foreground">Qualified</div>
            <div className="text-2xl font-bold text-foreground">{qualifiedCount}</div>
            <p className="text-xs text-muted-foreground">
              Ready to handoff to sales/CRM. Sync remains stubbed.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Lead list</div>
              <p className="text-xs text-muted-foreground">
                Status is internal only; “Sync to CRM” sets a timestamp locally. No external calls.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">Stubbed</Badge>
              <span>Data persists locally per browser.</span>
            </div>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campground</TableHead>
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
                    <TableCell className="space-y-1">
                      <Select
                        value={lead.status}
                        onValueChange={(value) => {
                          const status = getLeadStatus(value);
                          if (status) updateStatus.mutate({ id: lead.id, status });
                        }}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className="h-9 w-[150px]">
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
                      <Badge variant={statusBadge[lead.status].variant}>
                        {statusBadge[lead.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {lead.campgroundName || lead.campgroundId}
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
                          : "Sync to CRM (stub)"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
  );
}
