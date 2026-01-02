"use client";

import { useState, useEffect, ReactNode } from "react";
import { X, Lightbulb, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

type OnboardingHintProps = {
  id: string;
  title: string;
  content: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  showOnce?: boolean;
  className?: string;
  trigger?: "immediate" | "delay";
  delayMs?: number;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "ghost";
  }[];
};

export function OnboardingHint({
  id,
  title,
  content,
  placement = "bottom",
  showOnce = true,
  className = "",
  trigger = "immediate",
  delayMs = 1000,
  actions = []
}: OnboardingHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const storageKey = `campreserv:onboarding:hint:${id}`;

  useEffect(() => {
    // Check if hint was previously dismissed
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed && showOnce) {
      setIsDismissed(true);
      return;
    }

    // Show hint based on trigger type
    if (trigger === "immediate") {
      setIsVisible(true);
    } else if (trigger === "delay") {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [id, showOnce, trigger, delayMs, storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    if (showOnce) {
      localStorage.setItem(storageKey, "true");
    }
  };

  const handleGotIt = () => {
    handleDismiss();
  };

  if (!isVisible || isDismissed) {
    return null;
  }

  const placementClasses = {
    top: "bottom-full mb-3",
    bottom: "top-full mt-3",
    left: "right-full mr-3",
    right: "left-full ml-3"
  };

  return (
    <div
      className={`absolute z-40 ${placementClasses[placement]} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="relative bg-status-success-bg border border-status-success-border rounded-xl shadow-xl max-w-sm animate-fade-in">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-status-success text-status-success-foreground flex items-center justify-center">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-foreground">{title}</h4>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
              aria-label="Dismiss hint"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="text-sm text-foreground leading-relaxed mb-4">{content}</div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGotIt}
              size="sm"
              className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
            >
              Got it!
            </Button>
            {actions.map((action, idx) => (
              <Button
                key={idx}
                onClick={() => {
                  action.onClick();
                  handleDismiss();
                }}
                size="sm"
                variant={action.variant || "ghost"}
                className="text-foreground"
              >
                {action.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            ))}
          </div>
        </div>

        {/* Arrow indicator */}
        <div
          className={`absolute w-4 h-4 bg-status-success-bg border-status-success-border transform rotate-45 ${
            placement === "top"
              ? "bottom-[-9px] border-b-2 border-r-2 left-8"
              : placement === "bottom"
              ? "top-[-9px] border-t-2 border-l-2 left-8"
              : placement === "left"
              ? "right-[-9px] border-t-2 border-r-2 top-6"
              : "left-[-9px] border-b-2 border-l-2 top-6"
          }`}
        />
      </div>
    </div>
  );
}

export function PageOnboardingHint({
  id,
  title,
  content,
  actions = []
}: {
  id: string;
  title: string;
  content: ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "ghost";
  }[];
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const storageKey = `campreserv:onboarding:page-hint:${id}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show after a brief delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [id, storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem(storageKey, "true");
  };

  if (!isVisible || isDismissed) {
    return null;
  }

  return (
    <div className="mb-6 bg-status-success-bg border border-status-success-border rounded-xl shadow-lg p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-status-success text-status-success-foreground flex items-center justify-center">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
              aria-label="Dismiss hint"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="text-sm text-foreground leading-relaxed mb-4">{content}</div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDismiss}
              size="sm"
              className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
            >
              Got it!
            </Button>
            {actions.map((action, idx) => (
              <Button
                key={idx}
                onClick={() => {
                  action.onClick();
                  handleDismiss();
                }}
                size="sm"
                variant={action.variant || "ghost"}
                className="text-foreground"
              >
                {action.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
