"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Caravan,
  Home,
  Tent,
  Sparkles,
  TreePine,
  Building2,
  Hexagon,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";

export type CategoryType =
  | "all"
  | "rv"
  | "cabins"
  | "tents"
  | "glamping"
  | "lodges"
  | "unique"
  | "events";

interface CategoryTheme {
  bg: string;
  hoverBg: string;
  accent: string;
  activeBg: string;
  activeText: string;
  ring: string;
}

const categoryThemes: Record<CategoryType, CategoryTheme> = {
  all: {
    bg: "bg-slate-50",
    hoverBg: "hover:bg-slate-100",
    accent: "text-slate-600",
    activeBg: "bg-slate-800",
    activeText: "text-white",
    ring: "ring-slate-300"
  },
  rv: {
    bg: "bg-blue-50",
    hoverBg: "hover:bg-blue-100",
    accent: "text-blue-600",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    ring: "ring-blue-300"
  },
  cabins: {
    bg: "bg-amber-50",
    hoverBg: "hover:bg-amber-100",
    accent: "text-amber-600",
    activeBg: "bg-amber-600",
    activeText: "text-white",
    ring: "ring-amber-300"
  },
  tents: {
    bg: "bg-emerald-50",
    hoverBg: "hover:bg-emerald-100",
    accent: "text-emerald-600",
    activeBg: "bg-emerald-600",
    activeText: "text-white",
    ring: "ring-emerald-300"
  },
  glamping: {
    bg: "bg-violet-50",
    hoverBg: "hover:bg-violet-100",
    accent: "text-violet-600",
    activeBg: "bg-violet-600",
    activeText: "text-white",
    ring: "ring-violet-300"
  },
  lodges: {
    bg: "bg-rose-50",
    hoverBg: "hover:bg-rose-100",
    accent: "text-rose-600",
    activeBg: "bg-rose-600",
    activeText: "text-white",
    ring: "ring-rose-300"
  },
  unique: {
    bg: "bg-teal-50",
    hoverBg: "hover:bg-teal-100",
    accent: "text-teal-600",
    activeBg: "bg-teal-600",
    activeText: "text-white",
    ring: "ring-teal-300"
  },
  events: {
    bg: "bg-orange-50",
    hoverBg: "hover:bg-orange-100",
    accent: "text-orange-600",
    activeBg: "bg-orange-500",
    activeText: "text-white",
    ring: "ring-orange-300"
  }
};

interface Category {
  id: CategoryType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  siteTypes: string[]; // Maps to SiteType enum values
}

const categories: Category[] = [
  {
    id: "all",
    label: "All",
    icon: Sparkles,
    siteTypes: []
  },
  {
    id: "rv",
    label: "RV Sites",
    icon: Caravan,
    siteTypes: ["rv"]
  },
  {
    id: "cabins",
    label: "Cabins",
    icon: Home,
    siteTypes: ["cabin"]
  },
  {
    id: "tents",
    label: "Tent Sites",
    icon: Tent,
    siteTypes: ["tent", "group"]
  },
  {
    id: "glamping",
    label: "Glamping",
    icon: Hexagon,
    siteTypes: ["glamping", "safari_tent", "dome"]
  },
  {
    id: "lodges",
    label: "Lodges",
    icon: Building2,
    siteTypes: ["hotel_room", "suite", "lodge_room"]
  },
  {
    id: "unique",
    label: "Unique Stays",
    icon: TreePine,
    siteTypes: ["yurt", "treehouse", "tiny_house", "airstream"]
  },
  {
    id: "events",
    label: "Events",
    icon: Calendar,
    siteTypes: [] // Events are handled separately, not by site type
  }
];

interface CategoryTabsProps {
  activeCategory: CategoryType;
  onCategoryChange: (category: CategoryType) => void;
  className?: string;
}

export function CategoryTabs({
  activeCategory,
  onCategoryChange,
  className = ""
}: CategoryTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryType | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Check if scroll arrows should be visible
  const updateArrows = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateArrows();
    container.addEventListener("scroll", updateArrows);
    window.addEventListener("resize", updateArrows);

    return () => {
      container.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

  // Animation variants
  const iconVariants = {
    initial: { scale: 1 },
    hover: prefersReducedMotion
      ? {}
      : {
          scale: 1.15,
          transition: { type: "spring" as const, stiffness: 400, damping: 10 }
        },
    tap: prefersReducedMotion ? {} : { scale: 0.9 },
    active: { scale: 1.05 }
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: prefersReducedMotion ? {} : { scale: 1.02 },
    tap: prefersReducedMotion ? {} : { scale: 0.98 }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Left scroll arrow */}
      <AnimatePresence>
        {showLeftArrow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center"
          >
            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <motion.button
              onClick={() => scroll("left")}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="relative ml-1 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-3 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          const isHovered = hoveredCategory === category.id;
          const theme = categoryThemes[category.id];

          return (
            <motion.button
              key={category.id}
              variants={buttonVariants}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
              onClick={() => onCategoryChange(category.id)}
              onMouseEnter={() => setHoveredCategory(category.id)}
              onMouseLeave={() => setHoveredCategory(null)}
              className={`
                relative flex-shrink-0 flex flex-col items-center gap-1.5 px-5 py-3 rounded-full
                transition-all duration-200 border
                ${isActive
                  ? `${theme.activeBg} ${theme.activeText} border-transparent shadow-lg`
                  : `${theme.bg} ${theme.hoverBg} ${theme.accent} border-transparent`
                }
                ${!isActive && isHovered ? `ring-2 ring-offset-1 ${theme.ring}` : ""}
              `}
            >
              {/* Icon with animation */}
              <motion.div
                variants={iconVariants}
                animate={isActive ? "active" : isHovered ? "hover" : "initial"}
              >
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isActive ? theme.activeText : theme.accent
                  }`}
                />
              </motion.div>

              {/* Label */}
              <span className="text-xs font-medium whitespace-nowrap">
                {category.label}
              </span>

              {/* Active indicator underline */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${theme.activeBg}`}
                  initial={false}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 30 }
                  }
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Right scroll arrow */}
      <AnimatePresence>
        {showRightArrow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center"
          >
            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            <motion.button
              onClick={() => scroll("right")}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="relative mr-1 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom scrollbar hiding styles */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

// Export categories for use in filtering logic
export { categories, categoryThemes };
export type { Category, CategoryTheme };
