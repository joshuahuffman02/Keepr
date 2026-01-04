'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoImage } from '@/components/brand';

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

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

  const navigation = [
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Demo', href: '/demo' },
    { name: 'ROI Calculator', href: '/roi-calculator' },
  ];

  const compareLinks = [
    { name: 'vs Campspot', href: '/compare/campspot' },
    { name: 'vs Newbook', href: '/compare/newbook' },
    { name: 'vs CampLife', href: '/compare/camplife' },
    { name: 'Switch from Campspot', href: '/switch-from-campspot' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/owners" className="flex items-center">
              <LogoImage size="md" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-foreground hover:text-emerald-600 transition-colors font-medium"
              >
                {item.name}
              </Link>
            ))}
            {/* Compare Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCompareOpen(!compareOpen)}
                onBlur={() => setTimeout(() => setCompareOpen(false), 150)}
                className="flex items-center gap-1 text-foreground hover:text-emerald-600 transition-colors font-medium"
              >
                Compare
                <ChevronDown className={`h-4 w-4 transition-transform ${compareOpen ? 'rotate-180' : ''}`} />
              </button>
              {compareOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-2 z-50">
                  {compareLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-emerald-50 hover:text-emerald-600"
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
              <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
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
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 max-h-[70vh] overflow-y-auto">
            <Link href="/" className="block px-3 py-2 rounded-md text-base font-medium text-emerald-700 bg-emerald-50">
              Book a Campsite
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            {/* Compare Links */}
            <div className="px-3 py-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Compare</div>
              {compareLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
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
                <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
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
