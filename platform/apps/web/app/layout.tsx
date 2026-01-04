import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import ClientRoot from "./client-root";
import { RootJsonLd } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { fontVariables } from "@/lib/fonts";

import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(SEO_CONFIG.siteUrl),
  title: {
    template: "%s | Keepr",
    default: SEO_CONFIG.defaultTitle,
  },
  description: SEO_CONFIG.defaultDescription,
  keywords: [...SEO_CONFIG.keywords],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  applicationName: SEO_CONFIG.siteName,
  authors: [{ name: "Keepr Team" }],
  creator: "Keepr",
  publisher: "Keepr",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: SEO_CONFIG.locale,
    url: SEO_CONFIG.siteUrl,
    siteName: SEO_CONFIG.siteName,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: SEO_CONFIG.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SEO_CONFIG.twitterHandle,
    creator: SEO_CONFIG.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add these when you have them:
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
};

export const viewport: Viewport = {
  themeColor: SEO_CONFIG.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <RootJsonLd />
        <link rel="dns-prefetch" href="//images.unsplash.com" />
        <link rel="preconnect" href="//images.unsplash.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <ErrorBoundary>
            <ClientRoot>{children}</ClientRoot>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
