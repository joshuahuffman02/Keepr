import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover focus-visible:ring-ring",
        secondary:
          "bg-action-secondary text-action-secondary-foreground hover:bg-action-secondary-hover focus-visible:ring-ring/60",
        ghost: "text-foreground hover:bg-muted focus-visible:ring-ring/50",
        outline:
          "border border-border bg-background hover:bg-muted text-foreground focus-visible:ring-ring/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/50",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type BaseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    asChild?: boolean;
  };

type IconButtonProps = BaseButtonProps & {
  size: "icon";
  "aria-label": string;
};

type StandardButtonProps = BaseButtonProps & {
  size?: Exclude<VariantProps<typeof buttonVariants>["size"], "icon">;
};

export type ButtonProps = IconButtonProps | StandardButtonProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
