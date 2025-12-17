"use client";

import React from "react";

interface KeyboardHintProps {
  keys: string[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function KeyboardHint({ keys, className = "", size = "sm" }: KeyboardHintProps) {
  const isMac =
    typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const formatKey = (key: string): string => {
    if (key === "cmd") return isMac ? "⌘" : "Ctrl";
    if (key === "ctrl") return isMac ? "⌃" : "Ctrl";
    if (key === "shift") return isMac ? "⇧" : "Shift";
    if (key === "alt") return isMac ? "⌥" : "Alt";
    if (key === "escape") return "Esc";
    return key.toUpperCase();
  };

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-2.5 py-1.5 text-sm",
  };

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((key, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-slate-400 text-xs mx-0.5">+</span>}
          <kbd
            className={`${sizeClasses[size]} bg-white border border-slate-200 rounded font-mono text-slate-700 shadow-sm min-w-[20px] text-center inline-block`}
          >
            {formatKey(key)}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

// Usage examples:
// <KeyboardHint keys={["cmd", "k"]} />
// <KeyboardHint keys={["g", "d"]} size="md" />
// <KeyboardHint keys={["escape"]} className="ml-2" />
