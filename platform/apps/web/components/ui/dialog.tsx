"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  // Simple state management if not controlled (though usually controlled)
  const [isOpen, setIsOpen] = React.useState(open || false);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  // Always render children (so trigger is visible), context controls which parts show
  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Return false to prevent closing when the user clicks the overlay or presses Escape.
   */
  onRequestClose?: () => boolean | void;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onRequestClose, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const previousActiveElement = React.useRef<HTMLElement | null>(null);

    const attemptClose = () => {
      const result = onRequestClose?.();
      if (result === false) return;
      onOpenChange(false);
    };

    // Focus trap implementation
    React.useEffect(() => {
      if (!open || !contentRef.current) return;

      // Store previously focused element
      const activeElement = document.activeElement;
      previousActiveElement.current = activeElement instanceof HTMLElement ? activeElement : null;

      // Focus the dialog
      const firstFocusable = contentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();

      // Trap focus within dialog
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== "Tab" || !contentRef.current) return;

        const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      };

      document.addEventListener("keydown", handleTabKey);

      // Restore focus on unmount
      return () => {
        document.removeEventListener("keydown", handleTabKey);
        previousActiveElement.current?.focus();
      };
    }, [open]);

    React.useEffect(() => {
      if (!open) return;
      const handler = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          const result = onRequestClose?.();
          if (result === false) return;
          onOpenChange(false);
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [open, onOpenChange, onRequestClose]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={attemptClose}
          aria-hidden="true"
        />
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={cn(
            "z-50 grid w-full max-w-lg gap-4 border border-border bg-popover p-6 text-popover-foreground shadow-lg duration-200 sm:rounded-lg md:w-full",
            className,
          )}
          role="dialog"
          aria-modal="true"
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    id="dialog-title"
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogTrigger = ({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
  const { onOpenChange } = React.useContext(DialogContext);

  if (asChild && React.isValidElement<{ onClick?: React.MouseEventHandler }>(children)) {
    const handleClick: React.MouseEventHandler = (event) => {
      children.props.onClick?.(event);
      onOpenChange(true);
    };
    return React.cloneElement(children, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
};
DialogTrigger.displayName = "DialogTrigger";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    id="dialog-description"
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
};
