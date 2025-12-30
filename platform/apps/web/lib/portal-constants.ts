// Portal-wide constants for consistency across all guest portal pages

// Auth token key - use this everywhere instead of hardcoded strings
export const GUEST_TOKEN_KEY = "campreserv:guestToken";

// Animation configurations matching onboarding design
export const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

export const STAGGER_DELAY = 0.05;

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

// Status color mapping using semantic tokens (auto dark mode via CSS variables)
export const STATUS_VARIANTS = {
  success: {
    bg: "bg-status-success-bg",
    text: "text-status-success-text",
    border: "border-status-success-border",
  },
  warning: {
    bg: "bg-status-warning-bg",
    text: "text-status-warning-text",
    border: "border-status-warning-border",
  },
  error: {
    bg: "bg-status-error-bg",
    text: "text-status-error-text",
    border: "border-status-error-border",
  },
  info: {
    bg: "bg-status-info-bg",
    text: "text-status-info-text",
    border: "border-status-info-border",
  },
  neutral: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
} as const;

export type StatusVariant = keyof typeof STATUS_VARIANTS;
