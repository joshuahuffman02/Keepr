"use client";

import { useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal activities page error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="w-8 h-8 text-status-error" />
        <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
      </div>
      <p className="text-slate-600 mb-6 text-center max-w-md">
        {error.message || "Failed to load activities. Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
