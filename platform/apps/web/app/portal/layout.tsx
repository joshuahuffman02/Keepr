"use client";

import { usePathname } from "next/navigation";
import { GuestPortalTopNav, GuestPortalBottomNav } from "@/components/portal/GuestPortalNav";

// Pages that should NOT show the portal navigation (pre-auth pages)
const NO_NAV_PAGES = ["/portal/login", "/portal/verify"];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV_PAGES.some((page) => pathname.startsWith(page));

  if (!showNav) {
    // Return children without nav wrapper for login/verify pages
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <GuestPortalTopNav />
      <main className="pb-20 md:pb-8">{children}</main>
      <GuestPortalBottomNav />
    </div>
  );
}
