"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Sparkles,
  Lock,
  Unlock,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AiAccessLevel {
  tier: "none" | "trial" | "full" | "blocked";
  aiCallsUsed: number;
  aiCallsRemaining: number | null;
  reason?: string;
  canMakeAiCall: boolean;
  emailVerified: boolean;
  progressPercent: number;
}

interface AiAccessGateProps {
  sessionId: string;
  token: string;
  accessLevel: AiAccessLevel | null;
  onAccessChange: (level: AiAccessLevel) => void;
  email?: string;
}

export function AiAccessGate({
  sessionId,
  token,
  accessLevel,
  onAccessChange,
  email,
}: AiAccessGateProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  const requestVerification = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const response = await fetch(
        `${apiBase}/onboarding/session/${sessionId}/verify-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({ token, email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send verification");
      }

      if (data.alreadyVerified) {
        // Already verified, fetch updated status
        const statusRes = await fetch(
          `${apiBase}/onboarding/session/${sessionId}/ai-gate/status?token=${token}`,
          {
            headers: { "x-onboarding-token": token },
          }
        );
        const statusData = await statusRes.json();
        onAccessChange(statusData);
      } else {
        setMaskedEmail(data.email);
        setShowCodeInput(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const confirmCode = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const response = await fetch(
        `${apiBase}/onboarding/session/${sessionId}/confirm-email-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({ token, code: verificationCode }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid code");
      }

      onAccessChange(data.accessStatus);
      setShowCodeInput(false);
      setVerificationCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  // If no access level yet, show loading
  if (!accessLevel) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If already have full access, don't show anything
  if (accessLevel.tier === "full") {
    return null;
  }

  // If blocked, show error
  if (accessLevel.tier === "blocked") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-destructive/10 border border-destructive/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">AI Access Blocked</p>
            <p className="text-sm text-destructive/80">
              {accessLevel.reason || "Access has been blocked due to unusual activity."}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // If trial with remaining calls
  if (accessLevel.tier === "trial" && accessLevel.canMakeAiCall) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/5 border border-primary/20 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">AI Import Trial</p>
              <p className="text-sm text-muted-foreground">
                {accessLevel.aiCallsRemaining} AI calls remaining
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Complete {50 - accessLevel.progressPercent}% more steps for unlimited access
          </div>
        </div>
      </motion.div>
    );
  }

  // If trial exhausted or none, show verification flow
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-muted/50 border rounded-xl p-6"
    >
      <AnimatePresence mode="wait">
        {!showCodeInput ? (
          <motion.div
            key="request"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-lg">
                {accessLevel.tier === "none"
                  ? "Unlock AI-Assisted Import"
                  : "Get Unlimited AI Access"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {accessLevel.tier === "none"
                  ? "Verify your email to unlock 5 free AI-assisted imports"
                  : "You've used your trial imports. Complete more steps to unlock unlimited access."}
              </p>
            </div>

            {accessLevel.tier === "none" && (
              <Button
                onClick={requestVerification}
                disabled={isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send Verification Code
              </Button>
            )}

            {accessLevel.reason && (
              <p className="text-sm text-muted-foreground">{accessLevel.reason}</p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="verify"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-medium">Check your email</h3>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to {maskedEmail}
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                className="text-center text-xl tracking-widest"
                autoFocus
              />

              <Button
                onClick={confirmCode}
                disabled={isVerifying || verificationCode.length !== 6}
                className="w-full"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Verify & Unlock
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setShowCodeInput(false);
                  setVerificationCode("");
                  setError(null);
                }}
                className="w-full"
              >
                Go back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 text-destructive text-sm"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}
    </motion.div>
  );
}
