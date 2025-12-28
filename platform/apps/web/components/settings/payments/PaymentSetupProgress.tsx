"use client";

import { Check, CreditCard, Settings, TestTube } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentSetupProgressProps {
  stripeConnected: boolean;
  feesConfigured: boolean;
  testPaymentMade?: boolean;
}

interface Step {
  id: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export function PaymentSetupProgress({
  stripeConnected,
  feesConfigured,
  testPaymentMade = false,
}: PaymentSetupProgressProps) {
  const steps: Step[] = [
    {
      id: 1,
      label: "Connect Stripe",
      description: "Link your Stripe account",
      icon: <CreditCard className="w-4 h-4" />,
      completed: stripeConnected,
    },
    {
      id: 2,
      label: "Configure fees",
      description: "Set up platform fees",
      icon: <Settings className="w-4 h-4" />,
      completed: feesConfigured,
    },
    {
      id: 3,
      label: "Test payment",
      description: "Verify everything works",
      icon: <TestTube className="w-4 h-4" />,
      completed: testPaymentMade,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  if (allComplete) {
    return null; // Hide when setup is complete
  }

  return (
    <div
      className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100"
      role="navigation"
      aria-label="Payment setup progress"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-emerald-900">
          Getting started with payments
        </h3>
        <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
          {completedCount} of {steps.length} complete
        </span>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                  step.completed
                    ? "bg-emerald-500 text-white motion-safe:animate-in motion-safe:zoom-in"
                    : "bg-white border-2 border-slate-200 text-slate-500"
                )}
                aria-current={!step.completed && steps.slice(0, index).every(s => s.completed) ? "step" : undefined}
              >
                {step.completed ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{step.id}</span>
                )}
                <span className="sr-only">
                  Step {step.id}: {step.label} - {step.completed ? "Completed" : "Not completed"}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className={cn(
                  "text-sm font-medium",
                  step.completed ? "text-emerald-700" : "text-slate-600"
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "hidden sm:block h-0.5 w-8 mx-3 transition-colors duration-300",
                  step.completed ? "bg-emerald-300" : "bg-slate-200"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
