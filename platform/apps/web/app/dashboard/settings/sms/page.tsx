"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Phone,
  MessageSquare,
  ExternalLink,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Info,
  Building2,
} from "lucide-react";
import Link from "next/link";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

export default function SmsSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Get campground from local storage
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) setCampgroundId(stored);
  }, []);

  // Fetch existing SMS settings
  const settingsQuery = useQuery({
    queryKey: ["sms-settings", campgroundId],
    queryFn: () => apiClient.getSmsSettings(campgroundId!),
    enabled: !!campgroundId,
  });

  // Form state
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [smsWelcomeMessage, setSmsWelcomeMessage] = useState("");

  // Advanced: Own Twilio account
  const [useOwnAccount, setUseOwnAccount] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [authTokenSet, setAuthTokenSet] = useState(false);

  // Populate form when data loads
  useEffect(() => {
    if (settingsQuery.data) {
      setTwilioFromNumber(settingsQuery.data.twilioFromNumber || "");
      setSmsWelcomeMessage(settingsQuery.data.smsWelcomeMessage || "");
      setTwilioAccountSid(settingsQuery.data.twilioAccountSid || "");
      setAuthTokenSet(settingsQuery.data.twilioAuthTokenSet || false);
      // If they have their own account SID, show the advanced section
      setUseOwnAccount(!!settingsQuery.data.twilioAccountSid);
    }
  }, [settingsQuery.data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("Campground required");
      return apiClient.updateSmsSettings(campgroundId, {
        // Only set smsEnabled if they have their own account (otherwise platform handles it)
        smsEnabled: useOwnAccount ? true : undefined,
        twilioAccountSid: useOwnAccount ? twilioAccountSid || null : null,
        twilioAuthToken: useOwnAccount ? twilioAuthToken || undefined : null,
        twilioFromNumber: twilioFromNumber || null,
        smsWelcomeMessage: smsWelcomeMessage || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-settings", campgroundId] });
      toast({ title: "Saved", description: "SMS settings updated successfully." });
      if (twilioAuthToken) {
        setTwilioAuthToken("");
        setAuthTokenSet(true);
      }
    },
    onError: (err: unknown) => {
      toast({
        title: "Save failed",
        description: getErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  // Check configuration status
  const hasAssignedNumber = !!twilioFromNumber;
  const hasOwnAccount = useOwnAccount && twilioAccountSid && (authTokenSet || twilioAuthToken);

  if (!campgroundId) {
    return (
      <div className="max-w-4xl">
        <div className="p-6 text-muted-foreground">
          Select or create a campground to manage SMS settings.
        </div>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="max-w-4xl flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone className="h-6 w-6" />
          SMS / Text Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure SMS messaging for this campground.
        </p>
      </div>

      {/* Status Card */}
      <Card className={hasAssignedNumber ? "border-emerald-200 bg-emerald-50" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasAssignedNumber ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Check className="h-5 w-5 text-emerald-600" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">
                  {hasAssignedNumber ? "SMS Configured" : "SMS Not Configured"}
                </CardTitle>
                <CardDescription>
                  {hasAssignedNumber
                    ? `Sending from ${twilioFromNumber}`
                    : "Assign a phone number to enable SMS for this campground."}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Assigned Phone Number */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Phone Number</CardTitle>
          <CardDescription>
            The Twilio phone number this campground will use for SMS. Buy numbers in your{" "}
            <a
              href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline"
            >
              Twilio Console
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="twilioFromNumber">Phone Number</Label>
            <Input
              id="twilioFromNumber"
              value={twilioFromNumber}
              onChange={(e) => setTwilioFromNumber(e.target.value)}
              placeholder="+15551234567"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              E.164 format (e.g., +15551234567). This number must be in your Twilio account.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Message Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Message Settings</CardTitle>
          <CardDescription>Customize SMS behavior for this campground.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smsWelcomeMessage">Welcome Message (Optional)</Label>
            <Textarea
              id="smsWelcomeMessage"
              value={smsWelcomeMessage}
              onChange={(e) => setSmsWelcomeMessage(e.target.value)}
              placeholder="Example: Thanks for booking at Sunny Pines! Reply STOP to opt out."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Automatically sent when a guest's reservation is confirmed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">SMS Billing</p>
              <p className="text-sm text-blue-700">
                SMS usage is tracked per campground. You'll see SMS charges on your monthly invoice
                based on messages sent and received (~$0.0079/message for US numbers).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced: Own Twilio Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Use Own Twilio Account
              </CardTitle>
              <CardDescription>
                Optionally use your own Twilio account instead of the platform's.
              </CardDescription>
            </div>
            <Switch checked={useOwnAccount} onCheckedChange={setUseOwnAccount} />
          </div>
        </CardHeader>
        {useOwnAccount && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                With your own Twilio account, SMS costs are billed directly by Twilio to you, not
                through Campreserv.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilioAccountSid">Account SID</Label>
              <Input
                id="twilioAccountSid"
                value={twilioAccountSid}
                onChange={(e) => setTwilioAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilioAuthToken">Auth Token</Label>
              <div className="relative">
                <Input
                  id="twilioAuthToken"
                  type={showAuthToken ? "text" : "password"}
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  placeholder={authTokenSet ? "••••••••••••••••" : "Enter auth token"}
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthToken(!showAuthToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {authTokenSet && !twilioAuthToken && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Auth token is set. Leave blank to keep current value.
                </p>
              )}
            </div>

            <a
              href="https://console.twilio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Open Twilio Console
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Link href="/messages" className="text-sm text-muted-foreground hover:text-emerald-600">
          Go to Messages
        </Link>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </div>
  );
}
