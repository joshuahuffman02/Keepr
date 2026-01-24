"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

const AlertDialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

const AlertDialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = React.useState(open || false);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

const AlertDialogTrigger = ({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);

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
AlertDialogTrigger.displayName = "AlertDialogTrigger";

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(AlertDialogContext);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const previousActiveElement = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
      if (!open || !contentRef.current) return;

      const activeElement = document.activeElement;
      previousActiveElement.current = activeElement instanceof HTMLElement ? activeElement : null;

      const firstFocusable = contentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();

      // Handle Escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
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
            "z-50 grid w-full max-w-lg gap-4 border border-border bg-card p-6 shadow-lg duration-200 sm:rounded-lg md:w-full",
            className,
          )}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    id="alert-dialog-title"
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    id="alert-dialog-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      className={cn(
        "mt-2 inline-flex h-10 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0",
        className,
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
