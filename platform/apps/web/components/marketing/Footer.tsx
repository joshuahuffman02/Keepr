'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = {
  product: [
    { name: 'Features', href: '/owners#features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Demo', href: '/demo' },
    { name: 'ROI Calculator', href: '/roi-calculator' },
  ],
  compare: [
    { name: 'vs Campspot', href: '/compare/campspot' },
    { name: 'vs Newbook', href: '/compare/newbook' },
    { name: 'vs CampLife', href: '/compare/camplife' },
    { name: 'Switch from Campspot', href: '/switch-from-campspot' },
  ],
  resources: [
    { name: 'Blog', href: '/blog' },
    { name: 'Help Center', href: '/help' },
    { name: 'Campground Software', href: '/campground-management-software' },
    { name: 'RV Park Systems', href: '/rv-park-reservation-system' },
  ],
  legal: [
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
    { name: 'Security', href: '/security' },
  ],
};

const social = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/campeveryday',
    icon: Facebook,
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/campeveryday',
    icon: Twitter,
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/campeveryday',
    icon: Instagram,
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/campeveryday',
    icon: Linkedin,
  },
];

export function Footer() {
  const [copyrightClicks, setCopyrightClicks] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleCopyrightClick = useCallback(() => {
    const newClicks = copyrightClicks + 1;
    setCopyrightClicks(newClicks);

    if (newClicks >= 5 && !showEasterEgg) {
      setShowEasterEgg(true);
      // Reset after showing
      setTimeout(() => {
        setShowEasterEgg(false);
        setCopyrightClicks(0);
      }, 5000);
    }

    // Reset clicks if they stop clicking
    setTimeout(() => {
      setCopyrightClicks((current) => (current === newClicks ? 0 : current));
    }, 2000);
  }, [copyrightClicks, showEasterEgg]);

  return (
    <footer className="bg-muted text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <Link href="/owners" className="flex items-center space-x-2 mb-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l7 7-7 7M12 3l7 7-7 7" />
                  </svg>
                </div>
                <span className="font-bold text-xl text-white">
                  Camp Everyday Host
                </span>
              </Link>
              <p className="text-muted-foreground mb-6 max-w-sm">
                The most powerful platform for campground and RV park owners to streamline operations
                and grow their business.
              </p>

              {/* Contact Info */}
              <div className="space-y-2">
                <a href="tel:+1234567890" className="flex items-center gap-2 text-muted-foreground hover:text-emerald-400 transition-colors">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">(800) 555-CAMP</span>
                </a>
                <a href="mailto:hello@campeveryday.com" className="flex items-center gap-2 text-muted-foreground hover:text-emerald-400 transition-colors">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">hello@campeveryday.com</span>
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-3">
                {navigation.product.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-emerald-400 transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Compare Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Compare</h3>
              <ul className="space-y-3">
                {navigation.compare.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-emerald-400 transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-3">
                {navigation.resources.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-emerald-400 transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-3">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-emerald-400 transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-border py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Made with love message */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-rose-400 fill-rose-400 animate-pulse" />
              <span>and s'mores in Austin, Texas</span>
            </div>

            {/* Copyright with easter egg */}
            <button
              onClick={handleCopyrightClick}
              className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors cursor-default select-none"
            >
              Keep the campfire burning - {new Date().getFullYear()} Camp Everyday
            </button>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {social.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-muted-foreground hover:text-emerald-400 transition-colors"
                    aria-label={item.name}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Easter egg message */}
          <AnimatePresence>
            {showEasterEgg && (
              <motion.div
                className="mt-4 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-sm text-emerald-400">
                  You found a secret! Thanks for exploring every corner of our site.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  );
}
