"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

interface Section {
  id: string;
  label: string;
  href: string;
}

interface SectionTabsProps {
  sections: Section[];
  categoryId: string;
  className?: string;
}

export function SectionTabs({ sections, categoryId, className }: SectionTabsProps) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view on mount and path change
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        active.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [pathname]);

  const isActiveSection = (section: Section) => {
    if (!pathname) return false;
    // Exact match or starts with section href (for nested routes)
    return pathname === section.href || pathname.startsWith(`${section.href}/`);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "border-b bg-slate-50/80 overflow-x-auto scrollbar-hide",
        className
      )}
    >
      <nav
        role="tablist"
        aria-label={`${categoryId} sections`}
        className="flex items-center gap-1 px-4 min-w-max"
      >
        {sections.map((section, index) => {
          const isActive = isActiveSection(section);

          return (
            <Link
              key={section.id}
              ref={isActive ? activeRef : null}
              href={section.href}
              role="tab"
              aria-selected={isActive}
              data-level="2"
              data-index={index}
              className={cn(
                "px-3 py-2 text-sm transition-colors whitespace-nowrap",
                "border-b-2 -mb-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset",
                isActive
                  ? "border-slate-900 text-slate-900 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export type { Section };
