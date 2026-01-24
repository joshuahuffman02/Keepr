"use client";

import type { ReactNode } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAccent } from "./types";

const ACCENT_STYLES: Record<ChatAccent, { header: string; launcher: string; icon: string }> = {
  guest: {
    header: "bg-emerald-600 text-white",
    launcher: "bg-emerald-600 text-white hover:bg-emerald-700",
    icon: "bg-white/20 text-white",
  },
  staff: {
    header: "bg-blue-600 text-white",
    launcher: "bg-blue-600 text-white hover:bg-blue-700",
    icon: "bg-white/20 text-white",
  },
  public: {
    header: "bg-action-primary text-action-primary-foreground",
    launcher: "bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover",
    icon: "bg-card/20 text-action-primary-foreground",
  },
  support: {
    header: "bg-status-info text-status-info-foreground",
    launcher: "bg-status-info text-status-info-foreground hover:bg-status-info/90",
    icon: "bg-card/20 text-status-info-foreground",
  },
  partner: {
    header: "bg-status-success text-white",
    launcher: "bg-status-success text-white hover:bg-status-success/90",
    icon: "bg-white/20 text-white",
  },
};

type ChatShellProps = {
  isOpen: boolean;
  isMinimized?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  position?: "bottom-right" | "bottom-left";
  accent?: ChatAccent;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  launcherLabel: string;
  statusSlot?: ReactNode;
  headerActions?: ReactNode;
  allowMinimize?: boolean;
  widthClassName?: string;
  heightClassName?: string;
  className?: string;
  children: ReactNode;
};

export function ChatShell({
  isOpen,
  isMinimized = false,
  onOpen,
  onClose,
  onMinimize,
  onMaximize,
  position = "bottom-right",
  accent = "staff",
  title,
  subtitle,
  icon,
  launcherLabel,
  statusSlot,
  headerActions,
  allowMinimize = true,
  widthClassName = "w-[calc(100vw-2rem)] sm:w-96 2xl:w-[28rem]",
  heightClassName = "h-[calc(100vh-6rem)] sm:h-[600px] 2xl:h-[720px]",
  className,
  children,
}: ChatShellProps) {
  const styles = ACCENT_STYLES[accent];
  const positionClass =
    position === "bottom-right"
      ? "bottom-4 right-4 sm:bottom-6 sm:right-6"
      : "bottom-4 left-4 sm:bottom-6 sm:left-6";

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "fixed w-14 h-14 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]",
          styles.launcher,
          positionClass,
        )}
        aria-label={launcherLabel}
      >
        {icon}
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div
        className={cn(
          "fixed w-72 rounded-2xl shadow-xl overflow-hidden z-50 border border-border",
          positionClass,
        )}
      >
        <div
          className={cn("p-3 flex items-center justify-between cursor-pointer", styles.header)}
          onClick={onMaximize}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn("w-8 h-8 rounded-full flex items-center justify-center", styles.icon)}
            >
              {icon}
            </div>
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMaximize?.();
              }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Maximize chat"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-border max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]",
        widthClassName,
        heightClassName,
        positionClass,
        className,
      )}
    >
      <div className={cn("p-4 flex items-center justify-between", styles.header)}>
        <div className="flex items-center gap-3">
          <div
            className={cn("w-10 h-10 rounded-full flex items-center justify-center", styles.icon)}
          >
            {icon}
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              {title}
              {statusSlot}
            </div>
            {subtitle && <div className="text-xs text-white/80">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          {allowMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Minimize chat"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}
