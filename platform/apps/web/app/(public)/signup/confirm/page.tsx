"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useState, Suspense } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setResent(true);
    } catch (err) {
      console.error("Failed to resend:", err);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-8">
          <Mail className="h-10 w-10 text-emerald-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">Check Your Email</h1>

        <p className="text-slate-300 mb-2">We've sent a verification link to:</p>

        <p className="text-emerald-400 font-semibold text-lg mb-8">{email || "your email address"}</p>

        {/* Instructions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8 text-left">
          <h3 className="text-white font-semibold mb-4">Next Steps:</h3>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                1
              </span>
              <span className="text-slate-300">Open the email from Camp Everyday</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                2
              </span>
              <span className="text-slate-300">Click the verification link</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                3
              </span>
              <span className="text-slate-300">Complete your campground setup</span>
            </li>
          </ol>
        </div>

        {/* Resend */}
        <div className="mb-8">
          <p className="text-slate-500 text-sm mb-3">Didn't receive the email?</p>
          {resent ? (
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span>Email sent! Check your inbox.</span>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          )}
        </div>

        {/* Continue to sign in */}
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">Already verified?</p>
          <Button asChild className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400">
            <Link href="/auth/signin">
              Sign In to Continue
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Help */}
        <p className="mt-8 text-slate-500 text-sm">
          Having trouble?{" "}
          <a href="mailto:support@campeveryday.com" className="text-emerald-400 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="animate-pulse text-slate-400">Loading...</div>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
