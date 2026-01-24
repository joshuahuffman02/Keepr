"use client";

import { cn } from "../../lib/utils";

interface FloatingCartButtonProps {
  itemCount: number;
  totalCents: number;
  onClick: () => void;
}

export function FloatingCartButton({ itemCount, totalCents, onClick }: FloatingCartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "flex items-center gap-3",
        "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
        "text-white font-semibold",
        "px-6 py-4 rounded-full shadow-lg hover:shadow-xl",
        "transition-all duration-200 active:scale-95",
        "min-h-[56px]",
        "animate-in slide-in-from-bottom-5 fade-in duration-300",
      )}
      aria-label={`View cart with ${itemCount} items`}
    >
      {/* Cart Icon with Badge */}
      <div className="relative">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {itemCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {itemCount > 99 ? "99+" : itemCount}
          </div>
        )}
      </div>

      {/* Total */}
      <span className="text-lg font-bold">${(totalCents / 100).toFixed(2)}</span>
    </button>
  );
}
