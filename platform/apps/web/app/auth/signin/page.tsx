"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Strip query params (avoid email/password lingering in URL)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", "/auth/signin");
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(result?.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/logo/keepr-logo.png"
              alt="Keepr"
              width={180}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} method="POST" action="" className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>Use your Keepr credentials to sign in.</p>
        </div>
      </div>
    </div>
  );
}
