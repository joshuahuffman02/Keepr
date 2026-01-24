/**
 * Sentry Edge Runtime Configuration
 *
 * This runs in Next.js Edge Runtime (middleware, edge functions).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,
  });
}
