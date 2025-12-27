"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Info, Percent, Calendar, Users } from "lucide-react";

export default function DynamicPricingPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dynamic Pricing</h2>
        <p className="text-slate-500 mt-1">
          Automatically adjust rates based on demand and occupancy
        </p>
      </div>

      <Alert className="bg-purple-50 border-purple-200">
        <TrendingUp className="h-4 w-4 text-purple-500" />
        <AlertDescription className="text-purple-800">
          Dynamic pricing analyzes booking patterns to optimize your rates in real-time,
          maximizing revenue during high-demand periods.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enable Dynamic Pricing</CardTitle>
              <CardDescription>
                Automatically adjust rates based on occupancy levels
              </CardDescription>
            </div>
            <Switch />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-5 w-5 text-slate-500" />
            Occupancy-Based Adjustments
          </CardTitle>
          <CardDescription>
            Increase rates as occupancy rises for a given date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-slate-500 mb-1">0-50% Occupied</p>
              <p className="text-lg font-semibold text-slate-900">Base Rate</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-slate-500 mb-1">50-75% Occupied</p>
              <div className="flex items-center justify-center gap-1">
                <Input type="number" defaultValue="10" className="w-16 text-center" />
                <span className="text-lg font-semibold text-emerald-600">%</span>
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-slate-500 mb-1">75-100% Occupied</p>
              <div className="flex items-center justify-center gap-1">
                <Input type="number" defaultValue="20" className="w-16 text-center" />
                <span className="text-lg font-semibold text-emerald-600">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-500" />
            Lead Time Adjustments
          </CardTitle>
          <CardDescription>
            Adjust rates based on how far in advance guests book
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Early Bird Discount</Label>
              <p className="text-sm text-slate-500">
                Bookings made 60+ days in advance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="10" className="w-16 text-center" />
              <span className="text-sm text-slate-500">% off</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Last Minute Premium</Label>
              <p className="text-sm text-slate-500">
                Bookings made within 3 days of arrival
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="0" className="w-16 text-center" />
              <span className="text-sm text-slate-500">% increase</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            Length of Stay Incentives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Weekly Discount</Label>
              <p className="text-sm text-slate-500">7+ night stays</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="10" className="w-16 text-center" />
              <span className="text-sm text-slate-500">% off</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Monthly Discount</Label>
              <p className="text-sm text-slate-500">28+ night stays</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="25" className="w-16 text-center" />
              <span className="text-sm text-slate-500">% off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg">Save Pricing Rules</Button>
      </div>
    </div>
  );
}
