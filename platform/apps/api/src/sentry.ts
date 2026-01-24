import * as Sentry from "@sentry/node";

/**
 * Sentry Error Tracking Setup
 *
 * SETUP INSTRUCTIONS:
 * 1. Create free account at https://sentry.io/signup
 * 2. Create a new project for "Node.js"
 * 3. Get your DSN (looks like: https://xxx@xxx.ingest.sentry.io/xxx)
 * 4. Add to .env file: SENTRY_DSN=your_dsn_here
 * 5. Restart the API server
 *
 * Once configured, you'll receive alerts for all production errors!
 */

export function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;

  // Skip Sentry in test environment
  if (process.env.NODE_ENV === "test") {
    console.log("[Sentry] Skipped (test environment)");
    return;
  }

  // Warn if DSN is not configured
  if (!dsn) {
    console.warn(
      "[Sentry] DSN not configured. Error tracking disabled.\n" +
        "To enable:\n" +
        "  1. Sign up at https://sentry.io/signup\n" +
        "  2. Add SENTRY_DSN to .env\n" +
        "  3. Restart the server",
    );
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",

      // Performance monitoring - adjust sample rate as needed
      // 0.1 = 10% of requests are traced (good for production)
      // 1.0 = 100% of requests (good for development)
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // Capture console errors
      integrations: [
        // Console integration for capturing console.error messages
      ],

      // Before sending events, you can modify them here
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
            const queryString = event.request.query_string;
            if (
              typeof queryString === "string" &&
              (queryString.includes("token=") || queryString.includes("key="))
            ) {
              event.request.query_string = "[REDACTED]";
            }
          }
        }

        return event;
      },
    });

    console.log(`[Sentry] Initialized (environment: ${process.env.NODE_ENV})`);
  } catch (error) {
    console.error("[Sentry] Failed to initialize:", error);
  }
}

/**
 * Capture an exception manually
 *
 * Usage:
 * try {
 *   // risky operation
 * } catch (error) {
 *   captureError(error, { context: 'payment processing', userId: '123' });
 *   throw error;
 * }
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext("additional", context);
  }

  Sentry.captureException(error);
}

/**
 * Add breadcrumb for debugging
 *
 * Usage:
 * addBreadcrumb('Processing payment', { amount: 9999, currency: 'usd' });
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: "info",
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 *
 * Usage:
 * setUser({ id: '123', email: 'user@example.com' });
 */
export function setUser(user: { id: string; email?: string }) {
  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}
