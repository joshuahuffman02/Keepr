"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  getEmptyStateMessage,
  type EmptyStateContext,
} from "@/lib/empty-state-messages";

interface ConversationalEmptyStateProps {
  /** Context key for automatic messaging */
  context: EmptyStateContext;
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Override the default icon */
  icon?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button href (renders as Link) */
  actionHref?: string;
  /** Action button onClick (renders as Button) */
  onAction?: () => void;
  /** Additional class name */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    container: "py-8",
    icon: "w-12 h-12",
    title: "text-lg",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    icon: "w-16 h-16",
    title: "text-xl",
    description: "text-base",
  },
  lg: {
    container: "py-16",
    icon: "w-20 h-20",
    title: "text-2xl",
    description: "text-base",
  },
};

export function ConversationalEmptyState({
  context,
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
  className,
  size = "md",
}: ConversationalEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const message = getEmptyStateMessage(context);
  const styles = sizeStyles[size];

  const displayTitle = title ?? message.title;
  const displayDescription = description ?? message.description;
  const displayIcon = icon ?? message.icon;
  const displayActionLabel = actionLabel ?? message.actionLabel;
  const displayActionHref = actionHref ?? message.actionHref;

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        styles.container,
        className
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Icon with subtle animation */}
      <motion.div
        className={cn("relative mb-6", styles.icon)}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [0, -5, 0],
              }
        }
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Image
          src={displayIcon}
          alt=""
          fill
          className="object-contain"
          sizes={styles.icon.includes("20") ? "80px" : styles.icon.includes("16") ? "64px" : "48px"}
        />
      </motion.div>

      {/* Title */}
      <h3
        className={cn(
          "font-bold text-foreground mb-2 max-w-md",
          styles.title
        )}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-muted-foreground mb-6 max-w-sm",
          styles.description
        )}
      >
        {displayDescription}
      </p>

      {/* Action button */}
      {(displayActionLabel || onAction) && (
        <>
          {displayActionHref ? (
            <Link href={displayActionHref}>
              <Button variant="default" size={size === "sm" ? "sm" : "default"}>
                {displayActionLabel}
              </Button>
            </Link>
          ) : onAction ? (
            <Button
              variant="default"
              size={size === "sm" ? "sm" : "default"}
              onClick={onAction}
            >
              {displayActionLabel}
            </Button>
          ) : null}
        </>
      )}
    </motion.div>
  );
}

// Simpler inline version for smaller contexts
interface InlineEmptyStateProps {
  message: string;
  icon?: string;
  className?: string;
}

export function InlineEmptyState({
  message,
  icon = "/images/icons/confused-compass.png",
  className,
}: InlineEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 bg-muted rounded-xl text-sm text-muted-foreground",
        className
      )}
    >
      <div className="relative w-8 h-8 flex-shrink-0">
        <Image
          src={icon}
          alt=""
          fill
          className="object-contain opacity-60"
          sizes="32px"
        />
      </div>
      <p>{message}</p>
    </div>
  );
}
