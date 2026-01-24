"use client";

import "./pwa.css";
import { ReactNode, useEffect } from "react";

export default function PwaLayout({ children }: { children: ReactNode }) {
  // Register the PWA service worker for offline caching and queued retries.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("SW registration failed", err);
    });
  }, []);

  return <div className="min-h-screen bg-slate-900 text-slate-50">{children}</div>;
}
