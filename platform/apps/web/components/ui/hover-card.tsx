"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface HoverCardProps {
  children: React.ReactElement;
  content: React.ReactNode;
  className?: string;
  side?: "top" | "bottom";
  openDelay?: number;
  closeDelay?: number;
}

export function HoverCard({
  children,
  content,
  className,
  side = "top",
  openDelay = 300,
  closeDelay = 150,
}: HoverCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const openTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const contentWidth = 320; // Approximate width
    const contentHeight = 200; // Approximate height

    let top: number;
    let left = rect.left + rect.width / 2 - contentWidth / 2;

    // Keep within viewport horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));

    if (side === "top") {
      top = rect.top - contentHeight - 8;
      // If not enough space on top, flip to bottom
      if (top < 8) {
        top = rect.bottom + 8;
      }
    } else {
      top = rect.bottom + 8;
      // If not enough space on bottom, flip to top
      if (top + contentHeight > window.innerHeight - 8) {
        top = rect.top - contentHeight - 8;
      }
    }

    setPosition({ top, left });
  }, [side]);

  const handleMouseEnter = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    openTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, openDelay);
  }, [openDelay, updatePosition]);

  const handleMouseLeave = React.useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  }, [closeDelay]);

  React.useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Clone children to attach ref and event handlers
  const childElement = React.Children.only(children);

  const triggerElement = (
    <div
      ref={triggerRef}
      style={{ display: "contents" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {childElement}
    </div>
  );

  const portalContent =
    isOpen && mounted
      ? createPortal(
          <div
            ref={contentRef}
            className="fixed z-[100]"
            style={{
              top: position.top,
              left: position.left,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={cn(
                "bg-card rounded-lg shadow-xl border border-border p-0",
                "min-w-[280px] max-w-[360px]",
                "animate-in fade-in-0 zoom-in-95 duration-200",
                className,
              )}
            >
              {content}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {triggerElement}
      {portalContent}
    </>
  );
}

interface HoverCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function HoverCardHeader({ children, className }: HoverCardHeaderProps) {
  return <div className={cn("px-4 py-3 border-b border-border", className)}>{children}</div>;
}

interface HoverCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function HoverCardContent({ children, className }: HoverCardContentProps) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}

interface HoverCardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function HoverCardFooter({ children, className }: HoverCardFooterProps) {
  return (
    <div className={cn("px-4 py-2 border-t border-border bg-muted rounded-b-lg", className)}>
      {children}
    </div>
  );
}
