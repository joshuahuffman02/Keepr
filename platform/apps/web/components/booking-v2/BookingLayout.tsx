"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BookingLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Two-column booking layout with sticky sidebar on desktop.
 * On mobile, sidebar content moves to a sticky bottom bar.
 */
export function BookingLayout({ children, sidebar, footer, className }: BookingLayoutProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("min-h-screen bg-muted", className)}>
      {/* Main content area */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid lg:grid-cols-[1fr,380px] gap-6 lg:gap-10">
          {/* Left column - Main content */}
          <motion.main
            className="min-w-0 space-y-6"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.main>

          {/* Right column - Sticky sidebar (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {sidebar}
              </motion.div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky footer */}
      {footer && <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">{footer}</div>}

      {/* Spacer for mobile footer */}
      {footer && <div className="lg:hidden h-24" />}
    </div>
  );
}

/**
 * Card wrapper for booking sections
 */
export function BookingCard({
  children,
  className,
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div
      className={cn("bg-card rounded-xl border border-border shadow-sm overflow-hidden", className)}
    >
      {(title || description) && (
        <div className="px-5 py-4 border-b border-border">
          {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * Section divider with optional label
 */
export function BookingDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="flex items-center gap-4 py-2">
        <div className="flex-1 h-px bg-muted" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="flex-1 h-px bg-muted" />
      </div>
    );
  }
  return <div className="h-px bg-muted" />;
}
