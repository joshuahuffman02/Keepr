"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function VerifyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      return;
    }

    const verify = async () => {
      try {
        // SECURITY: Token is now stored in httpOnly cookie by the API
        // No localStorage needed - the cookie is automatically sent with requests
        await apiClient.verifyGuestToken(token);
        // Redirect to my-stay
        router.push("/portal/my-stay");
      } catch (err) {
        setError("Invalid or expired login link. Please try logging in again.");
      }
    };

    verify();
  }, [token, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Login Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{error}</p>
            <a href="/portal/login" className="text-primary hover:underline">
              Back to Login
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verifying your login...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 text-sm text-slate-600">
          Loading…
        </div>
      }
    >
      <VerifyPageInner />
    </Suspense>
  );
}
