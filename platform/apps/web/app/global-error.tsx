"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div
                className="rounded-full p-4"
                style={{ backgroundColor: "#fef2f2" }}
              >
                <AlertTriangle
                  className="h-12 w-12"
                  style={{ color: "#dc2626" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1
                className="text-2xl font-bold"
                style={{ color: "#0f172a" }}
              >
                Application Error
              </h1>
              <p style={{ color: "#475569" }}>
                A critical error has occurred. Please try refreshing the page.
              </p>
              {error.digest && (
                <p
                  className="text-xs font-mono"
                  style={{ color: "#94a3b8" }}
                >
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-white transition-colors"
              style={{ backgroundColor: "#059669" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#047857")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#059669")
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
