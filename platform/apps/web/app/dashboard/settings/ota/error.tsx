"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OtaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("OTA page error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-status-error/15 p-4">
            <AlertTriangle className="h-12 w-12 text-status-error" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            OTA Channels Error
          </h1>
          <p className="text-muted-foreground">
            There was an error loading the OTA Channels page. This might be a
            temporary issue.
          </p>

          {/* Show error details in development */}
          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                <Bug className="inline h-4 w-4 mr-1" />
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                {error.message}
                {"\n\n"}
                {error.stack}
              </pre>
            </details>
          )}

          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </Button>
        </div>
      </div>
    </div>
  );
}
