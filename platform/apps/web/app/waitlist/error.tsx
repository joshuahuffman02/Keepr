"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function WaitlistError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Waitlist error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <div className="text-center space-y-4 max-w-md">
                <div className="mx-auto w-12 h-12 rounded-full bg-status-error/15 border border-status-error/30 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-status-error" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Failed to load waitlist</h2>
                <p className="text-sm text-muted-foreground">
                    {error.message || "An unexpected error occurred while loading the waitlist."}
                </p>
                <Button onClick={reset} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try again
                </Button>
            </div>
        </div>
    );
}
