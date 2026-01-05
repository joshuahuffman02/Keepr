"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Campground } from "@keepr/shared";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import Image from "next/image";
import Link from "next/link";
import { ImageUpload } from "../ui/image-upload";
import { cn } from "@/lib/utils";
import { ChevronDown, Building2, MapPin, Image as ImageIcon, Clock, Settings2, Check } from "lucide-react";

interface CampgroundProfileFormProps {
  campground: Campground;
}

export function CampgroundProfileForm({ campground }: CampgroundProfileFormProps) {
  const qc = useQueryClient();
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [showAdvancedOps, setShowAdvancedOps] = useState(false);

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
    officeClosesAt: (campground as Campground & { officeClosesAt?: string }).officeClosesAt || "17:00",
    timezone: campground.timezone || "",
    slaMinutes: campground.slaMinutes?.toString() || "30",
    senderDomain: campground.senderDomain || "",
    quietHoursStart: campground.quietHoursStart || "",
    quietHoursEnd: campground.quietHoursEnd || "",
    routingAssigneeId: campground.routingAssigneeId || "",
    isPublished: campground.isPublished ?? true,
    currency: campground.currency || "USD",
    taxId: campground.taxId || "",
    taxIdName: campground.taxIdName || "Tax ID"
  });

  const photoList = form.photos
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const mutation = useMutation({
    mutationFn: async () => {
      interface CampgroundProfileUpdate {
        name?: string;
        slug?: string;
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        facebookUrl?: string | null;
        instagramUrl?: string | null;
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        postalCode?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        description?: string | null;
        tagline?: string | null;
        heroImageUrl?: string | null;
        photos?: string[];
        seasonStart?: string | null;
        seasonEnd?: string | null;
        checkInTime?: string | null;
        checkOutTime?: string | null;
        timezone?: string | null;
        isPublished?: boolean;
      }

      const profileUpdate: CampgroundProfileUpdate = {
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
      };

      const profile = await apiClient.updateCampgroundProfile(campground.id, profileUpdate);
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
        routingAssigneeId: form.routingAssigneeId || null,
        officeClosesAt: form.officeClosesAt || "17:00"
      });
      await apiClient.updateCampgroundFinancials(campground.id, {
        currency: form.currency,
        taxId: form.taxId || null,
        taxIdName: form.taxIdName
      });
      return profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campground", campground.id] });
    }
  });

  const heroPreview = form.heroImageUrl?.trim();

  return (
    <div className="space-y-4">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs py-2">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center gap-1.5 text-xs py-2">
            <MapPin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Location</span>
          </TabsTrigger>
          <TabsTrigger value="listing" className="flex items-center gap-1.5 text-xs py-2">
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Listing</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-1.5 text-xs py-2">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hours</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-1.5 text-xs py-2">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Profile & Contact</CardTitle>
                  <p className="text-sm text-muted-foreground">Basic information and how guests reach you</p>
                </div>
                <div className="text-[11px] rounded-full bg-muted px-3 py-1 font-mono text-muted-foreground">
                  ID: {campground.id.slice(0, 8)}...
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Campground Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="e.g., Sunny Pines RV Park"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Web Address (slug)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">campreserv.com/park/</span>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                      placeholder="sunny-pines"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                    placeholder="hello@keeprstay.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
                  placeholder="https://yourpark.com"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(checked) => setForm((s) => ({ ...s, isPublished: checked }))}
                />
                <div>
                  <span className="text-sm font-medium">Published</span>
                  <p className="text-xs text-muted-foreground">Visible on public booking pages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOCATION TAB */}
        <TabsContent value="location" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Location</CardTitle>
              <p className="text-sm text-muted-foreground">Where guests can find you</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={form.address1}
                    onChange={(e) => setForm((s) => ({ ...s, address1: e.target.value }))}
                    placeholder="123 River Road"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address Line 2 <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={form.address2}
                    onChange={(e) => setForm((s) => ({ ...s, address2: e.target.value }))}
                    placeholder="Suite, Lot, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ZIP/Postal</Label>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setForm((s) => ({ ...s, postalCode: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                    placeholder="USA"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select timezone...</option>
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="America/Anchorage">Alaska</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </select>
                <p className="text-xs text-muted-foreground">Used for booking times and guest communications</p>
              </div>

              {/* Collapsible advanced location */}
              <button
                type="button"
                onClick={() => setShowAdvancedLocation(!showAdvancedLocation)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedLocation && "rotate-180")} />
                Map coordinates (optional)
              </button>

              {showAdvancedLocation && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-muted">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      value={form.latitude}
                      onChange={(e) => setForm((s) => ({ ...s, latitude: e.target.value }))}
                      placeholder="e.g., 44.069"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      value={form.longitude}
                      onChange={(e) => setForm((s) => ({ ...s, longitude: e.target.value }))}
                      placeholder="e.g., -91.315"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Fine-tune where your park appears on maps. Leave blank to auto-detect from address.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LISTING TAB */}
        <TabsContent value="listing" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Public Listing</CardTitle>
              <p className="text-sm text-muted-foreground">How your park appears to guests</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label className="text-xs">Tagline</Label>
                <Input
                  value={form.tagline}
                  onChange={(e) => setForm((s) => ({ ...s, tagline: e.target.value }))}
                  placeholder="e.g., Your riverside retreat in the heart of nature"
                />
                <p className="text-xs text-muted-foreground">A short, catchy phrase shown under your park name</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={form.description || ""}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Tell guests what makes your park special..."
                  rows={4}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Hero Image</Label>
                <ImageUpload
                  value={form.heroImageUrl}
                  onChange={(url) => setForm((s) => ({ ...s, heroImageUrl: url }))}
                  placeholder="Upload your main photo"
                />
                {heroPreview && (
                  <div className="rounded-lg border overflow-hidden">
                    <img src={heroPreview} alt="Hero preview" className="w-full h-48 object-cover" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Gallery Photos</Label>
                <div className="bg-muted/50 p-4 rounded-lg border border-dashed space-y-3">
                  <ImageUpload
                    onChange={(url) => {
                      if (!url) return;
                      const current = form.photos ? form.photos.split(",").map(p => p.trim()).filter(Boolean) : [];
                      setForm(s => ({ ...s, photos: [...current, url].join(", ") }));
                    }}
                    placeholder="Add photo to gallery"
                  />
                </div>
                {photoList && photoList.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photoList.map((url) => (
                      <div key={url} className="relative h-20 w-full overflow-hidden rounded-lg border">
                        <Image src={url} alt="Gallery photo" fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Facebook Page</Label>
                  <Input
                    value={form.facebookUrl}
                    onChange={(e) => setForm((s) => ({ ...s, facebookUrl: e.target.value }))}
                    placeholder="https://facebook.com/yourpark"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Instagram</Label>
                  <Input
                    value={form.instagramUrl}
                    onChange={(e) => setForm((s) => ({ ...s, instagramUrl: e.target.value }))}
                    placeholder="https://instagram.com/yourpark"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERATIONS TAB */}
        <TabsContent value="operations" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Hours & Season</CardTitle>
              <p className="text-sm text-muted-foreground">When you're open and operating</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Check-in Time</Label>
                  <Input
                    value={form.checkInTime}
                    onChange={(e) => setForm((s) => ({ ...s, checkInTime: e.target.value }))}
                    placeholder="3:00 PM"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Check-out Time</Label>
                  <Input
                    value={form.checkOutTime}
                    onChange={(e) => setForm((s) => ({ ...s, checkOutTime: e.target.value }))}
                    placeholder="11:00 AM"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Office Closing Time</Label>
                <Input
                  type="time"
                  value={form.officeClosesAt}
                  onChange={(e) => setForm((s) => ({ ...s, officeClosesAt: e.target.value }))}
                  className="w-full md:w-40"
                />
                <div className="bg-muted/50 rounded-lg p-3 mt-2 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How same-day booking cutoffs work:</p>
                  <p>• RV/tent sites can be booked anytime (no cutoff by default)</p>
                  <p>• Cabins/lodging require booking 60 minutes before office close (for prep time)</p>
                  <p>• Customize cutoffs per site class in <Link href={`/campgrounds/${campground.id}/classes`} className="font-medium underline hover:no-underline">Site Classes</Link></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Season Start <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    type="date"
                    value={form.seasonStart}
                    onChange={(e) => setForm((s) => ({ ...s, seasonStart: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Season End <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    type="date"
                    value={form.seasonEnd}
                    onChange={(e) => setForm((s) => ({ ...s, seasonEnd: e.target.value }))}
                  />
                </div>
              </div>

              {/* Collapsible advanced ops */}
              <button
                type="button"
                onClick={() => setShowAdvancedOps(!showAdvancedOps)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedOps && "rotate-180")} />
                Message automation settings
              </button>

              {showAdvancedOps && (
                <div className="space-y-4 pl-6 border-l-2 border-muted">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reply Time Goal (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={form.slaMinutes}
                      onChange={(e) => setForm((s) => ({ ...s, slaMinutes: e.target.value }))}
                      placeholder="30"
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Messages waiting longer than this are flagged as "Needs reply"
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Do Not Disturb Hours</Label>
                    <div className="grid grid-cols-2 gap-4 max-w-xs">
                      <Input
                        value={form.quietHoursStart}
                        onChange={(e) => setForm((s) => ({ ...s, quietHoursStart: e.target.value }))}
                        placeholder="22:00"
                      />
                      <Input
                        value={form.quietHoursEnd}
                        onChange={(e) => setForm((s) => ({ ...s, quietHoursEnd: e.target.value }))}
                        placeholder="08:00"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automated emails/SMS pause during these hours and send next morning
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Financial Settings</CardTitle>
              <p className="text-sm text-muted-foreground">Currency and tax information for invoices</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax ID Label</Label>
                  <Input
                    value={form.taxIdName}
                    onChange={(e) => setForm((s) => ({ ...s, taxIdName: e.target.value }))}
                    placeholder="Tax ID"
                  />
                  <p className="text-xs text-muted-foreground">e.g., "EIN", "VAT Reg No"</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax ID Number</Label>
                  <Input
                    value={form.taxId}
                    onChange={(e) => setForm((s) => ({ ...s, taxId: e.target.value }))}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Email Deliverability</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional: Verify your domain for better email delivery
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                Most parks don't need to configure this. Only set up if you have a custom email domain
                and want emails to appear from your domain instead of campreserv.com
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sender Domain</Label>
                  <Input
                    value={form.senderDomain}
                    onChange={(e) => setForm((s) => ({ ...s, senderDomain: e.target.value }))}
                    placeholder="yourdomain.com"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Badge variant={campground.senderDomainStatus === "verified" ? "default" : "secondary"}>
                    {campground.senderDomainStatus || "Not configured"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Default Staff for New Conversations</Label>
                <Input
                  value={form.routingAssigneeId}
                  onChange={(e) => setForm((s) => ({ ...s, routingAssigneeId: e.target.value }))}
                  placeholder="Leave blank to not auto-assign"
                />
                <p className="text-xs text-muted-foreground">
                  Staff member who will be auto-assigned to new guest conversations
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-6 px-6 py-3 -mb-6 flex items-center justify-end gap-3">
        {mutation.isSuccess && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
        {mutation.isError && (
          <span className="text-sm text-destructive">Save failed - please try again</span>
        )}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
