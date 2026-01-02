"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface CampgroundProfile {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CampgroundProfile | null>(null);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient.getCampground(id)
      .then((data: any) => {
        setProfile({
          id: data.id,
          name: data.name || "",
          tagline: data.tagline || null,
          description: data.description || null,
          phone: data.phone || null,
          email: data.email || null,
          website: data.website || null,
          address1: data.address1 || null,
          address2: data.address2 || null,
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          country: data.country || "United States",
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!profile || !campgroundId) return;
    setSaving(true);
    try {
      await apiClient.updateCampgroundProfile(campgroundId, {
        name: profile.name,
        tagline: profile.tagline,
        description: profile.description,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        address1: profile.address1,
        address2: profile.address2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.zip,
        country: profile.country,
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Campground Profile</h2>
          <p className="text-muted-foreground mt-1">
            Basic information about your campground
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId || !profile) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Campground Profile</h2>
          <p className="text-muted-foreground mt-1">
            Basic information about your campground
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Campground Profile</h2>
        <p className="text-muted-foreground mt-1">
          Basic information about your campground
        </p>
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Basic Information
          </CardTitle>
          <CardDescription>
            This information appears on your booking page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campground Name</Label>
              <Input
                id="name"
                placeholder="Sunny Meadows Campground"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="Your home away from home"
                value={profile.tagline || ""}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value || null })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell guests about your campground..."
              rows={4}
              value={profile.description || ""}
              onChange={(e) => setProfile({ ...profile, description: e.target.value || null })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@campground.com"
                value={profile.email || ""}
                onChange={(e) => setProfile({ ...profile, email: e.target.value || null })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://www.campground.com"
                value={profile.website || ""}
                onChange={(e) => setProfile({ ...profile, website: e.target.value || null })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address1">Street Address</Label>
            <Input
              id="address1"
              placeholder="123 Campground Lane"
              value={profile.address1 || ""}
              onChange={(e) => setProfile({ ...profile, address1: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address2">Address Line 2</Label>
            <Input
              id="address2"
              placeholder="Suite, Unit, etc. (optional)"
              value={profile.address2 || ""}
              onChange={(e) => setProfile({ ...profile, address2: e.target.value || null })}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Campville"
                value={profile.city || ""}
                onChange={(e) => setProfile({ ...profile, city: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="CA"
                value={profile.state || ""}
                onChange={(e) => setProfile({ ...profile, state: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="12345"
                value={profile.zip || ""}
                onChange={(e) => setProfile({ ...profile, zip: e.target.value || null })}
              />
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="United States"
                value={profile.country || ""}
                onChange={(e) => setProfile({ ...profile, country: e.target.value || null })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
