"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { SkipToContent } from "@/components/ui/skip-to-content";
import { SyncStatusProvider } from "@/contexts/SyncStatusContext";
import { FeatureTourProvider } from "@/components/tours/FeatureTourProvider";
import { WebVitals } from "@/components/analytics/WebVitals";
import { EasterEggsProvider } from "@/contexts/EasterEggsContext";

// Dynamically import FloatingTicketWidget to avoid hydration issues with useQuery
const FloatingTicketWidget = dynamic(
  () => import("@/components/support/FloatingTicketWidget").then((mod) => mod.FloatingTicketWidget),
  { ssr: false }
);

interface WindowWithSW extends Window {
  __forceSWUpdate?: () => void;
}

export default function ClientRoot({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const pathname = usePathname();
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  const updateToastId = useRef<string | null>(null);
  const hideTicketWidgetPaths = [
    "/owners",
    "/compare",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/help",
    "/cookies",
    "/national-parks",
    "/roi-calculator",
    "/demo",
    "/pricing",
    "/campground-management-software",
    "/rv-park-reservation-system",
    "/switch-from-campspot"
  ];
  const shouldHideTicketWidget = hideTicketWidgetPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Prompt reload when the service worker broadcasts activation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sendSkipWaiting = () => {
      navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
    };
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SW_ACTIVATED") {
        const version = event.data?.version ?? "latest";
        setPendingUpdate(version);

        // Show persistent toast that requires user action - no auto-reload
        // This prevents interrupting forms, kiosk flows, and active work
        const { id } = toast({
          title: "Update available",
          description: "A new version is ready. Click to update when convenient.",
          duration: Infinity, // Persistent until dismissed or action taken
          action: (
            <ToastAction altText="Reload now" onClick={() => window.location.reload()}>
              Update Now
            </ToastAction>
          ),
        });
        updateToastId.current = id;
      }
      if (event.data === "SKIP_WAITING_ACK") {
        window.location.reload();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    // Expose manual trigger for programmatic skipWaiting if needed
    const win = window as WindowWithSW;
    win.__forceSWUpdate = sendSkipWaiting;
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [toast]);

  return (
    <SyncStatusProvider>
      <FeatureTourProvider>
        <EasterEggsProvider>
          <SkipToContent />
          {children}
          {!shouldHideTicketWidget && <FloatingTicketWidget />}
          <Toaster />
          <WebVitals />
        </EasterEggsProvider>
      </FeatureTourProvider>
    </SyncStatusProvider>
  );
}
