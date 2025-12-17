"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface SheetContextValue {
  isOpen: boolean;
  onClose: () => void;
}

const SheetContext = React.createContext<SheetContextValue | undefined>(undefined);

function useSheet() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a Sheet");
  }
  return context;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <SheetContext.Provider value={{ isOpen: open, onClose: handleClose }}>
      {children}
    </SheetContext.Provider>
  );
}

interface SheetPortalProps {
  children: React.ReactNode;
}

export function SheetPortal({ children }: SheetPortalProps) {
  const { isOpen } = useSheet();

  if (!isOpen) return null;

  return (
    typeof window !== "undefined" &&
    document.body &&
    React.createPortal(children, document.body)
  ) || null;
}

interface SheetOverlayProps {
  className?: string;
}

export function SheetOverlay({ className }: SheetOverlayProps) {
  const { isOpen, onClose } = useSheet();

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      onClick={onClose}
    />
  );
}

interface SheetContentProps {
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}

export function SheetContent({ side = "bottom", className, children }: SheetContentProps) {
  const { isOpen, onClose } = useSheet();
  const [startY, setStartY] = React.useState<number | null>(null);
  const [currentY, setCurrentY] = React.useState<number | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (side === "bottom") {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (side === "bottom" && startY !== null) {
      const currentYPos = e.touches[0].clientY;
      const deltaY = currentYPos - startY;

      if (deltaY > 0) {
        setCurrentY(deltaY);
      }
    }
  };

  const handleTouchEnd = () => {
    if (side === "bottom" && currentY !== null && currentY > 100) {
      onClose();
    }
    setStartY(null);
    setCurrentY(null);
  };

  const sideStyles = {
    top: "inset-x-0 top-0 border-b",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 border-r",
    right: "inset-y-0 right-0 border-l",
  };

  const animationStyles = {
    top: "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
    bottom: "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
    left: "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
    right: "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  };

  const transform = currentY && side === "bottom" ? `translateY(${currentY}px)` : undefined;

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={cn(
        "fixed z-50 bg-white shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        sideStyles[side],
        animationStyles[side],
        side === "bottom" && "rounded-t-2xl max-h-[85vh]",
        side === "top" && "rounded-b-2xl",
        (side === "left" || side === "right") && "w-3/4 sm:max-w-sm",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      style={{ transform }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}

interface SheetHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetHeader({ className, children }: SheetHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}>
      {children}
    </div>
  );
}

interface SheetTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetTitle({ className, children }: SheetTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold text-slate-900", className)}>
      {children}
    </h2>
  );
}

interface SheetDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetDescription({ className, children }: SheetDescriptionProps) {
  return (
    <p className={cn("text-sm text-slate-500", className)}>
      {children}
    </p>
  );
}
