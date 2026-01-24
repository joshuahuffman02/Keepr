"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Pin,
  PinOff,
  ChevronRight,
  GripVertical,
  Search,
  Info,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAGE_REGISTRY, type PageDefinition, getPagesByCategory } from "@/lib/page-registry";
import { ROLE_DEFAULT_MENUS, type UserRole, inferRoleFromPermissions } from "@/lib/default-menus";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MenuSetupProps {
  pinnedPages: string[];
  role?: UserRole;
  onChange: (pinnedPages: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const CATEGORY_LABELS: Record<string, string> = {
  operations: "Operations",
  guests: "Guests",
  finance: "Finance",
  marketing: "Marketing",
  reports: "Reports",
  settings: "Settings",
  store: "Store",
  staff: "Staff",
  admin: "Admin",
};

function SortableMenuItem({ page, onUnpin }: { page: PageDefinition; onUnpin: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.href,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5 group",
        isDragging && "opacity-50 ring-2 ring-emerald-500",
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 text-white text-sm">{page.label}</span>
      <button
        onClick={onUnpin}
        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
        aria-label={`Unpin ${page.label}`}
      >
        <PinOff className="w-4 h-4" />
      </button>
    </div>
  );
}

function PageCard({
  page,
  isPinned,
  onToggle,
}: {
  page: PageDefinition;
  isPinned: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
      onClick={onToggle}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg text-left transition-all",
        "border bg-slate-800/30 hover:bg-slate-800/50",
        isPinned
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-slate-700 hover:border-slate-600",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isPinned ? "bg-emerald-500/20" : "bg-slate-700/50",
        )}
      >
        {isPinned ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Pin className="w-4 h-4 text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isPinned ? "text-emerald-300" : "text-white")}>
          {page.label}
        </p>
        <p className="text-xs text-slate-500 truncate">{page.description}</p>
      </div>
    </motion.button>
  );
}

export function MenuSetup({
  pinnedPages: initialPinned,
  role = "manager",
  onChange,
  onNext,
  onBack,
  onSkip,
}: MenuSetupProps) {
  const prefersReducedMotion = useReducedMotion();

  // Start with role defaults if no pins provided
  const defaultPins = ROLE_DEFAULT_MENUS[role] || ROLE_DEFAULT_MENUS.manager;
  const [pinnedPages, setPinnedPages] = useState<string[]>(
    initialPinned.length > 0 ? initialPinned : defaultPins,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get all pages grouped by category
  const categories = Object.keys(CATEGORY_LABELS);

  // Filter pages based on search and category
  const filteredPages = PAGE_REGISTRY.filter((page) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        page.label.toLowerCase().includes(query) ||
        page.description.toLowerCase().includes(query) ||
        page.keywords.some((k) => k.toLowerCase().includes(query))
      );
    }
    if (selectedCategory) {
      return page.category === selectedCategory;
    }
    return true;
  });

  // Get pinned page objects
  const pinnedPageObjects = pinnedPages
    .map((href) => PAGE_REGISTRY.find((p) => p.href === href))
    .filter((p): p is PageDefinition => p !== undefined);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const activeId = String(active.id);
        const overId = String(over.id);
        const oldIndex = pinnedPages.indexOf(activeId);
        const newIndex = pinnedPages.indexOf(overId);
        const newOrder = arrayMove(pinnedPages, oldIndex, newIndex);
        setPinnedPages(newOrder);
        onChange(newOrder);
      }
    },
    [pinnedPages, onChange],
  );

  const togglePin = useCallback(
    (href: string) => {
      let newPinned: string[];
      if (pinnedPages.includes(href)) {
        newPinned = pinnedPages.filter((p) => p !== href);
      } else {
        newPinned = [...pinnedPages, href].slice(0, 15); // Max 15 items
      }
      setPinnedPages(newPinned);
      onChange(newPinned);
    },
    [pinnedPages, onChange],
  );

  const handleContinue = () => {
    onChange(pinnedPages);
    onNext();
  };

  const resetToDefaults = () => {
    setPinnedPages(defaultPins);
    onChange(defaultPins);
  };

  return (
    <div className="max-w-4xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 mb-4">
            <LayoutDashboard className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Personalize Your Dashboard</h2>
          <p className="text-slate-400">Choose which pages appear in your sidebar menu</p>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">Your menu, your way:</span> We've
            pre-selected pages based on your role. Add, remove, and reorder to match how you work.
            You can always change this later.
          </div>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Menu */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">
                Your Menu ({pinnedPages.length})
              </h3>
              <button
                onClick={resetToDefaults}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Reset to defaults
              </button>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-3 min-h-[300px]">
              {pinnedPageObjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center">
                  <Pin className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm">No pages pinned yet</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Select pages from the right to add them
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={pinnedPages} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {pinnedPageObjects.map((page) => (
                        <SortableMenuItem
                          key={page.href}
                          page={page}
                          onUnpin={() => togglePin(page.href)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </motion.div>

          {/* Available Pages */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-medium text-slate-300">All Pages</h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCategory(null);
                }}
                placeholder="Search pages..."
                className="pl-9 bg-slate-800/50 border-slate-700 text-white"
              />
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs transition-colors",
                  !selectedCategory
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-slate-800 text-slate-400 hover:text-slate-300",
                )}
              >
                All
              </button>
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs transition-colors",
                    selectedCategory === cat
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-800 text-slate-400 hover:text-slate-300",
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Page grid */}
            <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {filteredPages.slice(0, 20).map((page) => (
                  <PageCard
                    key={page.href}
                    page={page}
                    isPinned={pinnedPages.includes(page.href)}
                    onToggle={() => togglePin(page.href)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleContinue}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
            )}
          >
            Save & Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Use Defaults
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
