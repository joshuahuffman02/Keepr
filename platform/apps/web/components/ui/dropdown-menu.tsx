"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  contentRef: React.RefObject<HTMLDivElement>;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(component: string) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error(`${component} must be used within DropdownMenu`);
  }
  return ctx;
}

function isMutableRef<T>(ref: React.Ref<T>): ref is React.MutableRefObject<T | null> {
  return typeof ref === "object" && ref !== null && "current" in ref;
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
      } else if (isMutableRef(ref)) {
        ref.current = node;
      }
    });
  };
}

type DropdownMenuProps = {
  children: React.ReactNode;
  className?: string;
};

export function DropdownMenu({ children, className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    // Focus first item when menu opens
    const firstItem = contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      // Arrow key navigation within menu
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = Array.from(
          contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [],
        );
        if (items.length === 0) return;

        const currentIndex = items.findIndex((item) => item === document.activeElement);
        let nextIndex = currentIndex;

        if (event.key === "ArrowDown") {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        items[nextIndex]?.focus();
        setFocusedIndex(nextIndex);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={cn("relative inline-flex", className)}>{children}</div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  children: React.ReactElement;
};

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ asChild, children, className, onClick, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdownMenuContext("DropdownMenuTrigger");

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      setOpen(!open);
    };

    // Extract className from children if it's a valid React element
    const childClassName =
      React.isValidElement(children) && typeof children.props?.className === "string"
        ? children.props.className
        : undefined;

    const sharedProps = {
      ...props,
      onClick: handleClick,
      "aria-expanded": open,
      "aria-haspopup": "menu",
      className: cn(className, childClassName),
      ref: mergeRefs(ref, triggerRef),
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, sharedProps);
    }

    const buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      ref?: React.Ref<HTMLButtonElement>;
    } = {
      ...sharedProps,
      type: "button",
      "aria-haspopup": "menu",
      ref: mergeRefs(ref, triggerRef),
    };

    return <button {...buttonProps}>{children}</button>;
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
};

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "start", ...props }, ref) => {
    const { open, contentRef } = useDropdownMenuContext("DropdownMenuContent");
    if (!open) return null;

    return (
      <div
        {...props}
        ref={mergeRefs(ref, contentRef)}
        role="menu"
        className={cn(
          "absolute z-50 mt-2 min-w-[10rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          align === "end" ? "right-0" : "left-0",
          className,
        )}
      />
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, onClick, disabled, asChild, children, ...props }, ref) => {
    const { setOpen } = useDropdownMenuContext("DropdownMenuItem");

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(false);
      }
    };

    const itemClassName = cn(
      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 transition-colors",
      disabled && "cursor-not-allowed opacity-50",
      className,
    );

    if (asChild && React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
      return React.cloneElement(children, {
        role: "menuitem",
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (disabled) return;
          children.props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(false);
          }
        },
        className: cn(itemClassName, children.props.className),
      });
    }

    return (
      <button
        type="button"
        role="menuitem"
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={itemClassName}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuItem.displayName = "DropdownMenuItem";

type DropdownMenuSeparatorProps = React.HTMLAttributes<HTMLDivElement>;

export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        className={cn("-mx-1 my-1 h-px bg-border", className)}
        {...props}
      />
    );
  },
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
