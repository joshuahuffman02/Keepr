"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoImage } from "@/components/brand";

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const pathname = usePathname();
  const isOwnersPage = pathname === "/owners" || pathname?.startsWith("/owners/");
  const isPricingPage = pathname === "/pricing" || pathname?.startsWith("/pricing/");
  const ownersBase = isOwnersPage ? "" : "/owners";
  const compareMenuId = "marketing-compare-menu";
  const mobileMenuId = "marketing-mobile-menu";

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileMenuOpen]);

  const pricingHref = isOwnersPage ? "#pricing" : isPricingPage ? "#pricing" : "/pricing";

  const navigation = [
    { name: "Features", href: `${ownersBase}#features` },
    { name: "Pricing", href: pricingHref },
    { name: "Demo", href: "/demo" },
    { name: "ROI Calculator", href: "/roi-calculator" },
  ];

  const compareLinks = [
    { name: "vs Campspot", href: "/compare/campspot" },
    { name: "vs Newbook", href: "/compare/newbook" },
    { name: "vs CampLife", href: "/compare/camplife" },
    { name: "Switch from Campspot", href: "/switch-from-campspot" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/owners"
              className="flex items-center"
              aria-label="Keepr for Campground Owners"
            >
              <LogoImage size="md" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-foreground hover:text-keepr-evergreen transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {item.name}
              </Link>
            ))}
            {/* Compare Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCompareOpen(!compareOpen)}
                onBlur={() => setTimeout(() => setCompareOpen(false), 150)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setCompareOpen(false);
                  }
                }}
                className="flex items-center gap-1 text-foreground hover:text-keepr-evergreen transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                aria-haspopup="menu"
                aria-expanded={compareOpen}
                aria-controls={compareMenuId}
              >
                Compare
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${compareOpen ? "rotate-180" : ""}`}
                />
              </button>
              {compareOpen && (
                <div
                  id={compareMenuId}
                  role="menu"
                  className="absolute top-full left-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-2 z-50"
                >
                  {compareLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-foreground hover:bg-keepr-evergreen/10 hover:text-keepr-evergreen focus-visible:outline-none focus-visible:bg-keepr-evergreen/10 focus-visible:text-keepr-evergreen"
                      onClick={() => setCompareOpen(false)}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-foreground">
                Book a Campsite
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button variant="ghost" className="text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white">
                Get Started Free
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileMenuId}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div id={mobileMenuId} className="md:hidden py-4 space-y-2 max-h-[70vh] overflow-y-auto">
            <Link
              href="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-keepr-evergreen bg-keepr-evergreen/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              onClick={() => setMobileMenuOpen(false)}
            >
              Book a Campsite
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            {/* Compare Links */}
            <div className="px-3 py-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Compare
              </div>
              {compareLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
            </div>
            <div className="pt-4 space-y-2">
              <Link href="/auth/signin" className="block">
                <Button variant="ghost" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup" className="block">
                <Button className="w-full bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
