/** @type {import('next').NextConfig} */
const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

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
        hostname: "cdn.keeprstay.com",
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
  transpilePackages: ["@keepr/shared"],

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://static.cloudflareinsights.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://api.stripe.com wss://*.stripe.com https://maps.googleapis.com https://*.railway.app https://*.keeprstay.com https://keeprstay.com https://staging.keeprstay.com https://api-staging.keeprstay.com https://*.ingest.us.sentry.io https://*.sentry.io https://nominatim.openstreetmap.org https://*.cloudflareinsights.com http://localhost:* ws://localhost:*",
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
    // Use NEXT_PUBLIC_API_BASE for environment-specific backend URL
    // This enables staging environments to work correctly
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
    // Extract base URL without /api suffix for rewrites
    const backendUrl = apiBase.replace(/\/api\/?$/, "");

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
    // Only set outputFileTracingRoot for non-Vercel builds (Railway, local)
    // Vercel handles monorepo tracing differently
    ...(process.env.VERCEL ? {} : { outputFileTracingRoot: path.join(__dirname, "../../") }),
    // Enable instrumentation for Sentry (but not on Vercel due to compatibility issues)
    instrumentationHook: !process.env.VERCEL,
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

// Detect if this is a production build (main branch on Vercel)
const isProductionBuild = process.env.VERCEL_ENV === "production";

// Wrap with Sentry config to enable error tracking
// Disable heavy features for preview/staging builds to reduce memory usage
module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true, // Suppresses all logs
  org: "campreserv",
  project: "nextjs",

  // Only upload source maps for production builds (saves ~2GB memory)
  widenClientFileUpload: isProductionBuild,

  // Automatically annotate React components for better error messages
  // Disable for preview builds to save memory
  reactComponentAnnotation: {
    enabled: isProductionBuild,
  },

  // Don't auto-instrument (we do it manually via instrumentation.ts)
  autoInstrumentServerFunctions: false,

  // Hide Sentry from bundle analyzer
  hideSourceMaps: true,

  // Disable telemetry
  disableLogger: true,

  // Skip source map upload entirely for preview/staging builds
  sourcemaps: {
    disable: !isProductionBuild,
  },
});

// cache bust
// Force rebuild 1767569024
// Rebuild 1767571704
