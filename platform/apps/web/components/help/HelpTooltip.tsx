"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";

type HelpTooltipProps = {
  content: ReactNode;
  title?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  maxWidth?: number;
  className?: string;
  iconClassName?: string;
  variant?: "icon" | "inline";
  children?: ReactNode;
};

export function HelpTooltip({
  content,
  title,
  side = "top",
  align = "center",
  maxWidth = 320,
  className = "",
  iconClassName = "",
  variant = "icon",
  children
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Detect mobile devices
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Close on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Close on escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsOpen(false);
    }
  };

  // Calculate tooltip position
  const getTooltipPosition = () => {
    const positions: Record<string, string> = {
      top: "bottom-full mb-2",
      bottom: "top-full mt-2",
      left: "right-full mr-2",
      right: "left-full ml-2"
    };

    const alignments: Record<string, string> = {
      start: side === "top" || side === "bottom" ? "left-0" : "top-0",
      center: side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : "top-1/2 -translate-y-1/2",
      end: side === "top" || side === "bottom" ? "right-0" : "bottom-0"
    };

    return `${positions[side]} ${alignments[align]}`;
  };

  if (variant === "inline" && children) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {children}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`inline-flex items-center justify-center text-muted-foreground hover:text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded-full ${iconClassName}`}
          aria-label="Show help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        {isOpen && (
          <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden="true">
            <div className="absolute pointer-events-auto">
              <div
                ref={tooltipRef}
                className="bg-card border-2 border-emerald-200 rounded-lg shadow-xl p-4"
                style={{ maxWidth: `${maxWidth}px` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  {title && <h4 className="text-sm font-semibold text-foreground">{title}</h4>}
                  {isMobile && (
                    <button
                      onClick={() => setIsOpen(false)}
                      className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground"
                      aria-label="Close help"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="text-sm text-foreground leading-relaxed">{content}</div>
              </div>
            </div>
          </div>
        )}
      </span>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-emerald-600 hover:border-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${iconClassName}`}
        aria-label="Show help"
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 bg-card border-2 border-emerald-200 rounded-lg shadow-xl p-4 ${getTooltipPosition()}`}
          style={{ maxWidth: `${maxWidth}px` }}
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            {title && <h4 className="text-sm font-semibold text-foreground">{title}</h4>}
            {isMobile && (
              <button
                onClick={() => setIsOpen(false)}
                className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-foreground leading-relaxed">{content}</div>

          {/* Arrow indicator */}
          <div
            className={`absolute w-3 h-3 bg-card border-emerald-200 transform rotate-45 ${
              side === "top"
                ? "bottom-[-7px] border-b-2 border-r-2"
                : side === "bottom"
                ? "top-[-7px] border-t-2 border-l-2"
                : side === "left"
                ? "right-[-7px] border-t-2 border-r-2"
                : "left-[-7px] border-b-2 border-l-2"
            } ${
              align === "center"
                ? side === "top" || side === "bottom"
                  ? "left-1/2 -translate-x-1/2"
                  : "top-1/2 -translate-y-1/2"
                : ""
            }`}
          />
        </div>
      )}
    </div>
  );
}

export function HelpTooltipContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function HelpTooltipSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div>
      {title && <div className="font-semibold text-foreground mb-1">{title}</div>}
      <div className="text-foreground">{children}</div>
    </div>
  );
}

export function HelpTooltipList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-foreground">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  );
}

export function HelpTooltipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-emerald-600 hover:text-emerald-700 underline font-medium" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
