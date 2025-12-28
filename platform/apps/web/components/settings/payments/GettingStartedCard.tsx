"use client";

import { CreditCard, Shield, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GettingStartedCardProps {
  onConnect: () => void;
  isConnecting: boolean;
}

export function GettingStartedCard({ onConnect, isConnecting }: GettingStartedCardProps) {
  const benefits = [
    { icon: CreditCard, text: "Credit & debit cards" },
    { icon: Shield, text: "ACH bank transfers" },
    { icon: Zap, text: "Apple Pay & Google Pay" },
  ];

  return (
    <Card className="border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 overflow-hidden">
      <CardContent className="py-12 text-center relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full -translate-y-1/2 translate-x-1/2" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-100/50 rounded-full translate-y-1/2 -translate-x-1/2" aria-hidden="true" />

        <div className="relative">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in motion-safe:duration-500">
            <CreditCard className="w-8 h-8 text-emerald-600" aria-hidden="true" />
          </div>

          {/* Heading */}
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Start accepting payments
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Connect your Stripe account to accept payments from guests securely and get paid directly to your bank account.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-emerald-100"
              >
                <benefit.icon className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span className="text-sm text-slate-700">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <Button
            size="lg"
            onClick={onConnect}
            disabled={isConnecting}
            className="bg-emerald-600 hover:bg-emerald-700 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg motion-reduce:transform-none"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Connecting...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
                Connect Stripe
              </>
            )}
          </Button>

          {/* Helper text */}
          <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-hidden="true" />
            Takes about 5 minutes. You'll need your bank account info.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
