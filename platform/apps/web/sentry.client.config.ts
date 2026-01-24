/**
 * Sentry Client-Side Configuration
 *
 * This runs in the browser and tracks frontend errors.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create free account at https://sentry.io/signup
 * 2. Create a new project for "Next.js"
 * 3. Get your DSN (looks like: https://xxx@xxx.ingest.sentry.io/xxx)
 * 4. Add to .env.local file: NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
 * 5. Restart the dev server
 *
 * Once configured, you'll receive alerts for all frontend errors!
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Skip in development if DSN not configured
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Filter out sensitive data before sending to Sentry
    beforeSend(event, hint) {
      // Remove sensitive query parameters
      if (event.request?.url) {
        const url = new URL(event.request.url);
        if (url.searchParams.has("token")) {
          url.searchParams.set("token", "[REDACTED]");
          event.request.url = url.toString();
        }
      }

      return event;
    },
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] DSN not configured in production. Add NEXT_PUBLIC_SENTRY_DSN to enable error tracking.",
  );
}
