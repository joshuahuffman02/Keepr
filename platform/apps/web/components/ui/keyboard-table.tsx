"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KeyboardNavigableTable - Adds arrow key navigation to tables
 *
 * Features:
 * - Arrow Up/Down: Navigate between rows
 * - Enter/Space: Activate current row
 * - Home/End: Jump to first/last row
 * - Escape: Clear selection/focus
 */

interface KeyboardNavigableTableProps {
  children: React.ReactNode;
  className?: string;
  onRowActivate?: (rowIndex: number) => void;
  enableKeyboardNav?: boolean;
}

export function KeyboardNavigableTable({
  children,
  className,
  onRowActivate,
  enableKeyboardNav = true,
}: KeyboardNavigableTableProps) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [focusedRowIndex, setFocusedRowIndex] = React.useState<number>(-1);

  React.useEffect(() => {
    if (!enableKeyboardNav || !tableRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const table = tableRef.current;
      if (!table) return;

      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      if (rows.length === 0) return;

      const activeElement = document.activeElement;
      const closestRow = activeElement instanceof HTMLElement ? activeElement.closest("tr") : null;
      const currentRow = closestRow instanceof HTMLTableRowElement ? closestRow : null;
      const currentIndex = currentRow ? rows.indexOf(currentRow) : -1;

      let handled = false;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : 0;
          rows[nextIndex]?.focus();
          setFocusedRowIndex(nextIndex);
          handled = true;
          break;

        case "ArrowUp":
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : rows.length - 1;
          rows[prevIndex]?.focus();
          setFocusedRowIndex(prevIndex);
          handled = true;
          break;

        case "Home":
          e.preventDefault();
          rows[0]?.focus();
          setFocusedRowIndex(0);
          handled = true;
          break;

        case "End":
          e.preventDefault();
          rows[rows.length - 1]?.focus();
          setFocusedRowIndex(rows.length - 1);
          handled = true;
          break;

        case "Enter":
        case " ":
          if (currentIndex !== -1 && onRowActivate) {
            e.preventDefault();
            onRowActivate(currentIndex);
            handled = true;
          }
          break;

        case "Escape":
          e.preventDefault();
          setFocusedRowIndex(-1);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          handled = true;
          break;
      }

      if (handled) {
        e.stopPropagation();
      }
    };

    const table = tableRef.current;
    table.addEventListener("keydown", handleKeyDown);

    return () => {
      table.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableKeyboardNav, onRowActivate]);

  return (
    <div className={cn("relative w-full overflow-auto", className)}>
      <table ref={tableRef} className="w-full caption-bottom text-sm">
        {children}
      </table>
    </div>
  );
}

/**
 * Helper component for keyboard-navigable table rows
 */
interface KeyboardTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  onActivate?: () => void;
}

export const KeyboardTableRow = React.forwardRef<HTMLTableRowElement, KeyboardTableRowProps>(
  ({ className, onActivate, children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        tabIndex={0}
        className={cn(
          "border-b transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:bg-muted/50",
          onActivate && "cursor-pointer",
          className,
        )}
        onClick={onActivate}
        {...props}
      >
        {children}
      </tr>
    );
  },
);
KeyboardTableRow.displayName = "KeyboardTableRow";
