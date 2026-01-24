/**
 * Sentry Server-Side Configuration
 *
 * This runs on the Next.js server and tracks server-side errors.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create free account at https://sentry.io/signup
 * 2. Create a new project for "Next.js"
 * 3. Get your DSN (looks like: https://xxx@xxx.ingest.sentry.io/xxx)
 * 4. Add to .env.local file: SENTRY_DSN=your_dsn_here
 * 5. Restart the dev server
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    debug: false,

    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove authorization headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }

      return event;
    },
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] DSN not configured in production. Add SENTRY_DSN to enable error tracking.",
  );
}
