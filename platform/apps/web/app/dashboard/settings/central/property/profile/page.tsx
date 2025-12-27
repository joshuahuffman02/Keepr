"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, Globe } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Campground Profile</h2>
        <p className="text-slate-500 mt-1">
          Basic information about your campground
        </p>
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-500" />
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
                defaultValue=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="Your home away from home"
                defaultValue=""
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell guests about your campground..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-slate-500" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@campground.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://www.campground.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax (Optional)</Label>
              <Input id="fax" type="tel" placeholder="(555) 123-4568" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-500" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address1">Street Address</Label>
            <Input id="address1" placeholder="123 Campground Lane" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address2">Address Line 2</Label>
            <Input id="address2" placeholder="Suite, Unit, etc. (optional)" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Campville" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="CA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input id="zip" placeholder="12345" />
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="United States" defaultValue="United States" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg">Save Changes</Button>
      </div>
    </div>
  );
}
