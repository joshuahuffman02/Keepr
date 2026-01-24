"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recordTelemetry } from "@/lib/sync-telemetry";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

export default function NotificationPrefsPage() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const vapidKey = useMemo(() => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, []);
  const subscribeUrl = useMemo(() => process.env.NEXT_PUBLIC_PUSH_SUBSCRIBE_URL, []);
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api",
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const request = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      recordTelemetry({
        source: "notifications",
        type: "sync",
        status: perm === "granted" ? "success" : "failed",
        message: `Push permission ${perm}`,
      });
    } catch (err: unknown) {
      setPermission("default");
      const message = getErrorMessage(err, "Push permission request failed");
      recordTelemetry({
        source: "notifications",
        type: "error",
        status: "failed",
        message: "Push permission request failed",
        meta: { error: message },
      });
    }
  };

  const toUint8Array = (base64: string) => {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64Safe);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerDevice = async () => {
    if (permission !== "granted") {
      setSubscriptionStatus("Grant permission first.");
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSubscriptionStatus("Service worker not available.");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? toUint8Array(vapidKey) : undefined,
      });
      localStorage.setItem("campreserv:pushSubscription", JSON.stringify(sub));
      const url = subscribeUrl || `${apiBase}/push/subscribe`;
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("campreserv:authToken") : null;
        const campgroundId =
          typeof window !== "undefined"
            ? localStorage.getItem("campreserv:selectedCampground") || undefined
            : undefined;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(campgroundId ? { "x-campground-id": campgroundId } : {}),
          },
          body: JSON.stringify({ subscription: sub, campgroundId }),
        });
        setSubscriptionStatus("Registered with server.");
      } catch {
        setSubscriptionStatus("Saved locally; server registration failed.");
      }
      recordTelemetry({
        source: "notifications",
        type: "sync",
        status: "success",
        message: "Push subscription saved",
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Subscription failed");
      setSubscriptionStatus(message);
      recordTelemetry({
        source: "notifications",
        type: "error",
        status: "failed",
        message: "Push subscription failed",
        meta: { error: message },
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-4 space-y-4">
      <header className="pwa-card p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">PWA</div>
          <h1 className="text-xl font-semibold text-slate-50">Push Notifications</h1>
          <p className="text-slate-400 text-sm">Control push permission state for this device.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/pwa/sync-log">Sync Log</Link>
          </Button>
        </div>
      </header>

      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle className="text-slate-50">Permission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                permission === "granted"
                  ? "secondary"
                  : permission === "denied"
                    ? "destructive"
                    : "outline"
              }
            >
              {permission}
            </Badge>
            {permission === "unsupported" && (
              <span className="text-sm text-slate-300">Push is not supported in this browser.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={request} disabled={permission === "unsupported"}>
              {permission === "granted" ? "Re-request" : "Request permission"}
            </Button>
            <span className="text-xs text-slate-400">
              Grant to receive PWA notifications (stubbed).
            </span>
          </div>

          <div className="pt-4 space-y-2">
            <div className="text-sm text-slate-300">Device registration</div>
            <Button onClick={registerDevice} disabled={permission !== "granted"}>
              {permission === "granted" ? "Register this device" : "Grant permission first"}
            </Button>
            {subscriptionStatus && (
              <div className="text-xs text-slate-400">{subscriptionStatus}</div>
            )}
            {!vapidKey && (
              <div className="text-xs text-amber-300">
                VAPID key not set; subscription stored locally only. Configure
                NEXT_PUBLIC_VAPID_PUBLIC_KEY and NEXT_PUBLIC_PUSH_SUBSCRIBE_URL to send to server.
              </div>
            )}
            <div className="text-xs text-slate-500">
              Server registration requires you to be signed in; we include your bearer token and
              campground context if available.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
