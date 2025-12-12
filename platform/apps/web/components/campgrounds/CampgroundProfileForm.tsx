"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Campground } from "@campreserv/shared";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import Image from "next/image";

interface CampgroundProfileFormProps {
  campground: Campground;
}

export function CampgroundProfileForm({ campground }: CampgroundProfileFormProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: campground.name || "",
    slug: campground.slug || "",
    phone: campground.phone || "",
    email: campground.email || "",
    website: campground.website || "",
    facebookUrl: campground.facebookUrl || "",
    instagramUrl: campground.instagramUrl || "",
    address1: campground.address1 || "",
    address2: campground.address2 || "",
    city: campground.city || "",
    state: campground.state || "",
    country: campground.country || "",
    postalCode: campground.postalCode || "",
    latitude: campground.latitude?.toString() || "",
    longitude: campground.longitude?.toString() || "",
    description: campground.description || "",
    tagline: campground.tagline || "",
    heroImageUrl: campground.heroImageUrl || "",
    photos: campground.photos?.join(", ") || "",
    seasonStart: campground.seasonStart || "",
    seasonEnd: campground.seasonEnd || "",
    checkInTime: campground.checkInTime || "",
    checkOutTime: campground.checkOutTime || "",
    timezone: campground.timezone || "",
    slaMinutes: (campground as any).slaMinutes?.toString() || "30",
    senderDomain: (campground as any).senderDomain || "",
    quietHoursStart: (campground as any).quietHoursStart || "",
    quietHoursEnd: (campground as any).quietHoursEnd || "",
    routingAssigneeId: (campground as any).routingAssigneeId || "",
    isPublished: campground.isPublished ?? true
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const profile = await apiClient.updateCampgroundProfile(campground.id, {
        name: form.name || undefined,
        slug: form.slug || undefined,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        facebookUrl: form.facebookUrl || null,
        instagramUrl: form.instagramUrl || null,
        address1: form.address1 || null,
        address2: form.address2 || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        postalCode: form.postalCode || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        description: form.description || null,
        tagline: form.tagline || null,
        heroImageUrl: form.heroImageUrl || null,
        photos: photoList && photoList.length > 0 ? photoList : [],
        seasonStart: form.seasonStart || null,
        seasonEnd: form.seasonEnd || null,
        checkInTime: form.checkInTime || null,
        checkOutTime: form.checkOutTime || null,
        timezone: form.timezone || null,
        isPublished: form.isPublished
      });
      const sla = form.slaMinutes ? Number(form.slaMinutes) : null;
      if (sla && Number.isFinite(sla)) {
        await apiClient.updateCampgroundSla(campground.id, sla);
      }
      if (form.senderDomain?.trim()) {
        await apiClient.updateCampgroundSenderDomain(campground.id, form.senderDomain.trim());
      }
      await apiClient.updateCampgroundOps(campground.id, {
        quietHoursStart: form.quietHoursStart || null,
        quietHoursEnd: form.quietHoursEnd || null,
        routingAssigneeId: form.routingAssigneeId || null
      });
      return profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground", campground.id] });
    }
  });

  const heroPreview = form.heroImageUrl?.trim();
  const photoList = form.photos
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Identity & contact</CardTitle>
              <p className="text-xs text-slate-500">Name, slug, and how guests reach you.</p>
            </div>
            <div className="text-[11px] rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-600">ID: {campground.id}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Campground name"
                aria-label="Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Slug (URL)</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                placeholder="slug-for-urls"
                aria-label="Slug"
              />
              <p className="text-xs text-slate-500">Used in links and public pages.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="e.g., (555) 123-4567"
                aria-label="Phone"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="reservations@yourpark.com"
                aria-label="Email"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Website</label>
              <Input
                value={form.website}
                onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
                placeholder="https://yourpark.com"
                aria-label="Website"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isPublished}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, isPublished: checked }))}
                aria-label="Published"
              />
              <span className="text-sm text-slate-700">Published (visible online)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Address line 1</label>
              <Input
                value={form.address1}
                onChange={(e) => setForm((s) => ({ ...s, address1: e.target.value }))}
                placeholder="123 River Rd"
                aria-label="Address line 1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Address line 2</label>
              <Input
                value={form.address2}
                onChange={(e) => setForm((s) => ({ ...s, address2: e.target.value }))}
                placeholder="Suite / Lot"
                aria-label="Address line 2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">City</label>
              <Input
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                placeholder="City"
                aria-label="City"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">State/Province</label>
              <Input
                value={form.state}
                onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
                placeholder="State/Province"
                aria-label="State"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Postal code</label>
              <Input
                value={form.postalCode}
                onChange={(e) => setForm((s) => ({ ...s, postalCode: e.target.value }))}
                placeholder="ZIP / Postal"
                aria-label="Postal code"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Country</label>
              <Input
                value={form.country}
                onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                placeholder="Country"
                aria-label="Country"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Latitude</label>
              <Input
                value={form.latitude}
                onChange={(e) => setForm((s) => ({ ...s, latitude: e.target.value }))}
                placeholder="e.g., 44.069"
                aria-label="Latitude"
              />
              <p className="text-xs text-slate-500">Used to center your map.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Longitude</label>
              <Input
                value={form.longitude}
                onChange={(e) => setForm((s) => ({ ...s, longitude: e.target.value }))}
                placeholder="e.g., -91.315"
                aria-label="Longitude"
              />
              <p className="text-xs text-slate-500">Used to center your map.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Timezone</label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                placeholder="e.g., America/Chicago"
                aria-label="Timezone"
              />
              <p className="text-xs text-slate-500">IANA format for emails and arrivals.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hero & gallery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Hero image URL</label>
            <Input
              value={form.heroImageUrl}
              onChange={(e) => setForm((s) => ({ ...s, heroImageUrl: e.target.value }))}
              placeholder="https://..."
              aria-label="Hero image URL"
            />
            {heroPreview && (
              <div className="relative mt-2 h-40 w-full overflow-hidden rounded-lg border border-slate-200">
                <Image src={heroPreview} alt="Hero preview" fill className="object-cover" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Gallery photos (comma-separated URLs)</label>
            <Textarea
              value={form.photos}
              onChange={(e) => setForm((s) => ({ ...s, photos: e.target.value }))}
              placeholder="https://img1.jpg, https://img2.jpg"
              aria-label="Gallery photos"
            />
            {photoList && photoList.length > 0 && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photoList.map((url) => (
                  <div key={url} className="relative h-24 w-full overflow-hidden rounded border border-slate-200 bg-slate-50">
                    <Image src={url} alt="Photo" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Public profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={form.tagline}
              onChange={(e) => setForm((s) => ({ ...s, tagline: e.target.value }))}
              placeholder="Tagline"
              aria-label="Tagline"
            />
            <Input
              value={form.heroImageUrl}
              onChange={(e) => setForm((s) => ({ ...s, heroImageUrl: e.target.value }))}
              placeholder="Hero image URL"
              aria-label="Hero image URL"
            />
            <Input
              value={form.facebookUrl}
              onChange={(e) => setForm((s) => ({ ...s, facebookUrl: e.target.value }))}
              placeholder="Facebook URL"
              aria-label="Facebook URL"
            />
            <Input
              value={form.instagramUrl}
              onChange={(e) => setForm((s) => ({ ...s, instagramUrl: e.target.value }))}
              placeholder="Instagram URL"
              aria-label="Instagram URL"
            />
          </div>
          <Textarea
            value={form.description || ""}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            placeholder="Public description for the listing"
            aria-label="Description"
            rows={4}
          />
          {heroPreview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500 mb-2">Hero preview</div>
              <img src={heroPreview} alt="Hero preview" className="w-full max-h-64 object-cover rounded-md" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            value={form.checkInTime}
            onChange={(e) => setForm((s) => ({ ...s, checkInTime: e.target.value }))}
            placeholder="Check-in time (e.g., 3:00 PM)"
            aria-label="Check-in time"
          />
          <Input
            value={form.checkOutTime}
            onChange={(e) => setForm((s) => ({ ...s, checkOutTime: e.target.value }))}
            placeholder="Check-out time (e.g., 11:00 AM)"
            aria-label="Check-out time"
          />
          <Input
            value={form.seasonStart}
            onChange={(e) => setForm((s) => ({ ...s, seasonStart: e.target.value }))}
            placeholder="Season start (YYYY-MM-DD)"
            aria-label="Season start"
          />
          <Input
            value={form.seasonEnd}
            onChange={(e) => setForm((s) => ({ ...s, seasonEnd: e.target.value }))}
            placeholder="Season end (YYYY-MM-DD)"
            aria-label="Season end"
          />
          <div className="space-y-1">
            <Input
              type="number"
              min={1}
              max={720}
              value={form.slaMinutes}
              onChange={(e) => setForm((s) => ({ ...s, slaMinutes: e.target.value }))}
              placeholder="SLA minutes (e.g., 30)"
              aria-label="SLA minutes"
            />
            <p className="text-xs text-slate-500">Minutes before inbound guest messages are marked “Needs reply”.</p>
          </div>
          <Input
            value={form.quietHoursStart}
            onChange={(e) => setForm((s) => ({ ...s, quietHoursStart: e.target.value }))}
            placeholder="Quiet hours start (HH:mm)"
            aria-label="Quiet hours start"
          />
          <Input
            value={form.quietHoursEnd}
            onChange={(e) => setForm((s) => ({ ...s, quietHoursEnd: e.target.value }))}
            placeholder="Quiet hours end (HH:mm)"
            aria-label="Quiet hours end"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deliverability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={form.senderDomain}
              onChange={(e) => setForm((s) => ({ ...s, senderDomain: e.target.value }))}
              placeholder="Sender domain (e.g., campreserv.com)"
              aria-label="Sender domain"
            />
            <div className="flex items-center gap-2">
              <Badge variant={(campground as any).senderDomainStatus === "verified" ? "default" : "secondary"}>
                {(campground as any).senderDomainStatus || "unknown"}
              </Badge>
              {(campground as any).senderDomainCheckedAt && (
                <span className="text-xs text-slate-500">
                  Checked {(campground as any).senderDomainCheckedAt}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Verify DMARC/SPF on your sending domain. We’ll check _dmarc.{`<domain>`} and SPF TXT records.
          </p>
          <div className="space-y-1">
            <Label>Default routing assignee (user id)</Label>
            <Input
              value={form.routingAssigneeId}
              onChange={(e) => setForm((s) => ({ ...s, routingAssigneeId: e.target.value }))}
              placeholder="User ID for routing"
              aria-label="Routing assignee"
            />
            <p className="text-xs text-slate-500">Optional: assign inbound triage to this user by default.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save configuration"}
        </Button>
        {mutation.isSuccess && <span className="ml-3 text-sm text-emerald-600">Updated</span>}
        {mutation.isError && <span className="ml-3 text-sm text-rose-600">Save failed</span>}
      </div>
    </div>
  );
}

