"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { FloatingTicketWidget } from "@/components/support/FloatingTicketWidget";
import { SkipToContent } from "@/components/ui/skip-to-content";
import { SyncStatusProvider } from "@/contexts/SyncStatusContext";
import { FeatureTourProvider } from "@/components/tours/FeatureTourProvider";
import { WebVitals } from "@/components/analytics/WebVitals";
import { EasterEggsProvider } from "@/contexts/EasterEggsContext";

interface WindowWithSW extends Window {
  __forceSWUpdate?: () => void;
}

export default function ClientRoot({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  const reloadTimer = useRef<number | null>(null);

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
        if (reloadTimer.current) {
          window.clearTimeout(reloadTimer.current);
        }
        // Auto-reload after a short delay if the user doesn't click.
        reloadTimer.current = window.setTimeout(() => {
          window.location.reload();
        }, 10000);
        toast({
          title: "Update ready",
          description: "A new offline update is available. Reload to apply.",
          action: (
            <ToastAction altText="Reload now" onClick={() => window.location.reload()}>
              Reload
            </ToastAction>
          ),
        });
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
          <FloatingTicketWidget />
          <Toaster />
          <WebVitals />
        </EasterEggsProvider>
      </FeatureTourProvider>
    </SyncStatusProvider>
  );
}

