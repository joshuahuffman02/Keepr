'use client';

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

type LeadCaptureFormProps = {
  defaultCampgroundId?: string;
  defaultCampgroundName?: string;
  title?: string;
};

export function LeadCaptureForm({
  defaultCampgroundId = "public-site",
  defaultCampgroundName = "Public site",
  title = "Tell us about your park",
}: LeadCaptureFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", interest: "" });
  const [submitting, setSubmitting] = useState(false);
  const [campgroundId, setCampgroundId] = useState(defaultCampgroundId);

  useEffect(() => {
    if (!campgroundId && typeof window !== "undefined") {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      if (stored) setCampgroundId(stored);
    }
  }, [campgroundId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.interest.trim()) {
      toast({
        title: "Missing details",
        description: "Please add your name, email, and what you're looking for.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const lead = await apiClient.saveLead({
        campgroundId: campgroundId || defaultCampgroundId,
        campgroundName: defaultCampgroundName,
        name: form.name.trim(),
        email: form.email.trim(),
        interest: form.interest.trim(),
        source: "public-landing",
      });

      toast({
        title: "Thanks! We'll reach out.",
        description: `Captured internally for ${lead.campgroundName || "your campground"} — CRM sync stays stubbed.`,
      });
      setForm({ name: "", email: "", interest: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save lead.";
      toast({
        title: "Could not capture lead",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm shadow-emerald-500/5">
      <div className="border-b border-border p-6">
        <div className="text-sm font-semibold text-emerald-700">Lead capture (internal only)</div>
        <h3 className="text-xl font-bold text-foreground mt-1">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We keep this in-app — no CRM calls are made. Leads are scoped per campground for easy routing with statuses
          (new, contacted, qualified) visible in Admin &gt; Marketing &gt; Leads.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            name="name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Alex Camper"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="alex@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="interest">
            Interest
          </label>
          <Textarea
            id="interest"
            name="interest"
            rows={3}
            value={form.interest}
            onChange={(e) => setForm((prev) => ({ ...prev, interest: e.target.value }))}
            placeholder="Tell us what you want to improve — bookings, marketing, guest experience, or operations."
            required
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Routed to: {defaultCampgroundName} ({campgroundId || defaultCampgroundId})
          </span>
          <span>CRM sync remains stubbed for safety.</span>
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving..." : "Save lead (internal)"}
        </Button>
      </form>
    </div>
  );
}

