/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "cdn.campeveryday.com",
      },
      {
        protocol: "https",
        hostname: "cdn.recreation.gov",
      },
    ],
    // Optimize image formats
    formats: ["image/avif", "image/webp"],
    // Configure device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize layout shift
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Ensure external workspace packages are bundled correctly
  transpilePackages: ["@campreserv/shared"],

  // Enable strict mode for better debugging
  reactStrictMode: true,

  // Compress responses
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Power by header (disable for security)
  poweredByHeader: false,

  // Headers for security and caching
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    // Content Security Policy directives
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://api.stripe.com wss://*.stripe.com https://maps.googleapis.com https://*.railway.app http://localhost:* ws://localhost:*",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://hooks.stripe.com",
      "frame-ancestors 'none'",
      isProduction ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
          // HTTP Strict Transport Security (HSTS) - only in production
          ...(isProduction ? [{
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          }] : []),
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // XSS Protection (legacy but still useful)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer Policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions Policy - restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
          // Cross-Origin policies
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JS/CSS with revalidation
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      // Redirect old park URL format to new
      {
        source: "/campground/:slug",
        destination: "/park/:slug",
        permanent: true,
      },
      // Redirect with trailing slash
      {
        source: "/park/:slug/",
        destination: "/park/:slug",
        permanent: true,
      },
      // Redirect /help/contact to /tickets (consolidated)
      {
        source: "/help/contact",
        destination: "/tickets",
        permanent: true,
      },
    ];
  },

  // Rewrites to proxy API requests to the backend
  async rewrites() {
    // In production, use the Railway API backend URL
    // In development, use localhost
    const isProduction = process.env.NODE_ENV === "production";
    const backendUrl = isProduction
      ? "https://camp-everydayapi-production.up.railway.app"
      : "http://localhost:4000";

    // Use afterFiles so that Next.js API routes (like /api/auth/*) are matched first
    // Only requests that don't match any page/API route will be rewritten
    return {
      beforeFiles: [],
      afterFiles: [],
      // fallback rewrites only apply if no page or afterFiles rewrite matches
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },

  // Experimental features for performance
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    // Optimize package imports
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "recharts",
      "@tanstack/react-query",
    ],
  },

};

module.exports = nextConfig;
