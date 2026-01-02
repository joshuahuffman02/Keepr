"use client";

import React from "react";
import {
  CreditCard,
  Wallet,
  Smartphone,
  Landmark,
  Banknote,
  FileText,
  Home,
  Gift,
  Lock,
  Square,
  Zap,
  SmartphoneNfc,
  Wallet2,
} from "lucide-react";
import { PaymentMethodType, PAYMENT_METHOD_INFO } from "../context/types";
import { usePaymentContext } from "../context/PaymentContext";
import { usePaymentMethods, sortMethodsByPriority } from "../hooks/usePaymentMethods";
import { cn } from "../../../../lib/utils";

// Icon mapping
const methodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  wallet: Wallet,
  "wallet-2": Wallet2,
  smartphone: Smartphone,
  "smartphone-nfc": SmartphoneNfc,
  landmark: Landmark,
  banknote: Banknote,
  "file-text": FileText,
  home: Home,
  gift: Gift,
  lock: Lock,
  square: Square,
  zap: Zap,
  apple: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  ),
};

interface MethodSelectorProps {
  onSelect?: (method: PaymentMethodType) => void;
  disabled?: boolean;
}

export function MethodSelector({ onSelect, disabled = false }: MethodSelectorProps) {
  const { state, actions, props } = usePaymentContext();
  const { availableMethods, loading } = usePaymentMethods();

  const sortedMethods = sortMethodsByPriority(availableMethods, props.context);

  const handleSelect = (method: PaymentMethodType) => {
    if (disabled) return;
    actions.selectMethod(method);
    onSelect?.(method);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-20 bg-muted animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (sortedMethods.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payment methods available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {sortedMethods.map((method) => {
        const info = PAYMENT_METHOD_INFO[method];
        const IconComponent = methodIcons[info.icon] || CreditCard;
        const isSelected = state.selectedMethod === method;

        // Special states
        const hasWallet = method === "guest_wallet" && state.walletBalanceCents > 0;
        const hasTerminal = method === "terminal" && state.terminalReaders.some((r) => r.status === "online");
        const hasSavedCards = method === "saved_card" && state.savedCards.length > 0;

        return (
          <button
            key={method}
            onClick={() => handleSelect(method)}
            disabled={disabled}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
              "hover:border-emerald-500 hover:bg-emerald-50",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
              isSelected
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-foreground",
              disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card"
            )}
          >
            <IconComponent className="w-6 h-6 mb-2" />
            <span className="text-sm font-medium text-center">{info.label}</span>

            {/* Wallet balance badge */}
            {hasWallet && (
              <span className="absolute top-1 right-1 text-xs bg-status-success-bg text-status-success-text px-1.5 py-0.5 rounded-full">
                ${(state.walletBalanceCents / 100).toFixed(2)}
              </span>
            )}

            {/* Terminal status badge */}
            {method === "terminal" && (
              <span
                className={cn(
                  "absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded-full",
                  hasTerminal
                    ? "bg-status-success-bg text-status-success-text"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {hasTerminal ? "Ready" : "Offline"}
              </span>
            )}

            {/* Saved cards count badge */}
            {hasSavedCards && (
              <span className="absolute top-1 right-1 text-xs bg-status-info-bg text-status-info-text px-1.5 py-0.5 rounded-full">
                {state.savedCards.length} card{state.savedCards.length > 1 ? "s" : ""}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
