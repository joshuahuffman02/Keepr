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

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
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
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
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
    const childClassName = React.isValidElement(children) && children.props && 'className' in children.props
      ? (children.props.className as string | undefined)
      : undefined;

    const sharedProps = {
      ...props,
      onClick: handleClick,
      "aria-expanded": open,
      "aria-haspopup": "menu",
      className: cn(className, childClassName),
      ref: mergeRefs(ref, triggerRef as React.Ref<HTMLElement>),
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
      ref: mergeRefs(ref as React.Ref<HTMLButtonElement>, triggerRef as React.Ref<HTMLButtonElement>),
    };

    return (
      <button {...buttonProps}>
        {children}
      </button>
    );
  }
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
          "absolute z-50 mt-2 min-w-[10rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg",
          align === "end" ? "right-0" : "left-0",
          className
        )}
      />
    );
  }
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
      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
      disabled && "cursor-not-allowed opacity-50",
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        role: "menuitem",
        onClick: (event: React.MouseEvent) => {
          if (disabled) return;
          (children as React.ReactElement<any>).props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(false);
          }
        },
        className: cn(itemClassName, (children as React.ReactElement<any>).props.className),
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
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

type DropdownMenuSeparatorProps = React.HTMLAttributes<HTMLDivElement>;

export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        className={cn("-mx-1 my-1 h-px bg-slate-200", className)}
        {...props}
      />
    );
  }
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
