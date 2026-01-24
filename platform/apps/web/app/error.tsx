"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
          <p className="text-slate-600">
            We apologize for the inconvenience. An unexpected error has occurred.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
