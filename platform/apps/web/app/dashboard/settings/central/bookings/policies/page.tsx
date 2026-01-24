"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, DollarSign, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BookingPoliciesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Booking Policies</h2>
        <p className="text-muted-foreground mt-1">
          Configure check-in times, cancellation rules, and deposit requirements
        </p>
      </div>

      {/* Check-in/Check-out Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Check-in & Check-out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-time">Check-in Time</Label>
              <Select defaultValue="15:00">
                <SelectTrigger id="checkin-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const hour = i + 12;
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {hour > 12 ? hour - 12 : hour}:00 PM
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-time">Check-out Time</Label>
              <Select defaultValue="11:00">
                <SelectTrigger id="checkout-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => {
                    const hour = i + 8;
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {hour}:00 AM
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Allow early check-in requests</Label>
              <p className="text-sm text-muted-foreground">
                Guests can request early arrival (subject to availability)
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Allow late check-out requests</Label>
              <p className="text-sm text-muted-foreground">
                Guests can request late departure (may incur fee)
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Deposit Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Deposit Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Deposit Amount</Label>
            <div className="flex items-center gap-2">
              <Input id="deposit-amount" type="number" defaultValue="50" className="w-24" />
              <Select defaultValue="percent">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% of total</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="first_night">First night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance-due">Balance Due</Label>
            <Select defaultValue="checkin">
              <SelectTrigger id="balance-due">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">At check-in</SelectItem>
                <SelectItem value="arrival">Day of arrival</SelectItem>
                <SelectItem value="days_before">Days before arrival</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Cancellation Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Set up tiered cancellation policies based on days before arrival. These rules
              determine refund amounts for cancelled reservations.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-3 rounded-lg border">
              <div className="flex-1">
                <p className="font-medium">14+ days before arrival</p>
                <p className="text-sm text-muted-foreground">Full refund minus processing fee</p>
              </div>
              <Input type="number" defaultValue="100" className="w-20" />
              <span className="text-muted-foreground">%</span>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-lg border">
              <div className="flex-1">
                <p className="font-medium">7-13 days before arrival</p>
                <p className="text-sm text-muted-foreground">Partial refund</p>
              </div>
              <Input type="number" defaultValue="50" className="w-20" />
              <span className="text-muted-foreground">%</span>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-lg border">
              <div className="flex-1">
                <p className="font-medium">Less than 7 days</p>
                <p className="text-sm text-muted-foreground">No refund</p>
              </div>
              <Input type="number" defaultValue="0" className="w-20" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policy Text */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Policy Text
          </CardTitle>
          <CardDescription>Displayed to guests during booking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancellation-text">Cancellation Policy</Label>
            <Textarea
              id="cancellation-text"
              rows={4}
              defaultValue="Cancellations made 14 or more days before arrival receive a full refund minus a $25 processing fee. Cancellations 7-13 days before arrival receive a 50% refund. Cancellations less than 7 days before arrival are non-refundable."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rules-text">Campground Rules</Label>
            <Textarea
              id="rules-text"
              rows={4}
              placeholder="Enter your campground rules that guests must acknowledge..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg">Save Policies</Button>
      </div>
    </div>
  );
}
