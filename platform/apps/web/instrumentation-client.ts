/**
 * Client-side instrumentation hook for Next.js (Turbopack compatible).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,
    beforeSend(event) {
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
