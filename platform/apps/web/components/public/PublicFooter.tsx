"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Heart, Facebook, Instagram, Twitter, MapPin, Mail } from "lucide-react";
import { apiClient } from "@/lib/api-client";

const navigation = {
  explore: [
    { name: "Find Campgrounds", href: "/camping" },
    { name: "National Parks", href: "/national-parks" },
    { name: "RV Parks", href: "/?category=rv" },
    { name: "Cabins & Lodges", href: "/?category=cabins" },
    { name: "Browse by State", href: "/camping" },
  ],
  company: [
    { name: "About Us", href: "/about" },
    { name: "Our Impact", href: "/#charity" },
    { name: "For Campground Owners", href: "/owners" },
    { name: "Careers", href: "/careers" },
  ],
  support: [
    { name: "Help Center", href: "/help" },
    { name: "Contact Us", href: "/contact" },
    { name: "FAQs", href: "/help#faq" },
    { name: "Cancellation Policy", href: "/help#cancellation" },
  ],
  legal: [
    { name: "Terms of Service", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Cookie Policy", href: "/cookies" },
  ],
};

const social = [
  { name: "Facebook", href: "https://facebook.com/keeprstay", icon: Facebook },
  { name: "Instagram", href: "https://instagram.com/keeprstay", icon: Instagram },
  { name: "Twitter", href: "https://twitter.com/keeprstay", icon: Twitter },
];

export function PublicFooter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    try {
      await apiClient.saveLead({
        name: "Newsletter subscriber",
        email: email.trim(),
        interest: "newsletter",
        source: "public-footer",
      });
      setEmail("");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <footer className="bg-slate-900 text-white mt-20">
      {/* Newsletter Section */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-semibold mb-2">Get camping inspiration & deals</h3>
              <p className="text-slate-400 text-sm">
                Join thousands of families discovering their next adventure.
              </p>
            </div>
            <div className="w-full md:w-auto space-y-2">
              <form className="flex gap-3 w-full md:w-auto" onSubmit={handleSubscribe}>
                <div className="flex-1 md:w-64">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-keepr-evergreen focus:ring-1 focus:ring-keepr-evergreen"
                    autoComplete="email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-keepr-evergreen hover:bg-keepr-evergreen/90 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
              <p className="text-xs text-slate-400 md:text-right" aria-live="polite">
                {status === "success" && "Thanks for subscribing! Check your inbox for updates."}
                {status === "error" && "We couldn't subscribe you right now. Try again soon."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-keepr-evergreen to-teal-600 flex items-center justify-center shadow-lg">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m4 20 8-14 8 14" />
                  <path d="M2 20h20" />
                </svg>
              </div>
              <span className="text-xl font-bold">Keepr</span>
            </div>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">
              Find your perfect campground and create memories that last a lifetime. Family-trusted,
              nature-approved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {social.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-keepr-evergreen hover:text-white transition-colors"
                    aria-label={item.name}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
              Explore
            </h4>
            <ul className="space-y-3">
              {navigation.explore.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-slate-300 hover:text-white transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-slate-300 hover:text-white transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              {navigation.support.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-slate-300 hover:text-white transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
              Get in Touch
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="mailto:hello@keeprstay.com"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  hello@keeprstay.com
                </a>
              </li>
              <li className="text-slate-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Austin, Texas
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Made with love */}
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
              <span>and s'mores in Austin, Texas</span>
            </div>

            {/* Copyright */}
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Keepr. All rights reserved.
            </p>

            {/* Legal Links */}
            <div className="flex items-center gap-4">
              {navigation.legal.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
