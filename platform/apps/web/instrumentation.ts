/**
 * Next.js Instrumentation
 * This file runs when Next.js starts up and loads Sentry
 */

export async function register() {
  if (process.env.OTEL_ENABLED === "true" || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    await import("./otel");
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(err: Error) {
  // This runs on unhandled errors
  if (typeof window === "undefined") {
    // Server-side - already handled by sentry.server.config
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err);
  }
}
