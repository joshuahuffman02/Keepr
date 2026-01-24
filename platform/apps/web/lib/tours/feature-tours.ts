/**
 * Feature Tour Definitions
 *
 * Each tour consists of multiple steps that guide users through features.
 * Tours can be triggered on first login, after updates, or manually.
 */

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  placement?: "top" | "bottom" | "left" | "right" | "center";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export interface FeatureTour {
  id: string;
  name: string;
  description: string;
  version: number; // Increment to re-show tour after updates
  trigger: "first_login" | "manual" | "feature_update";
  requiredRole?: string[];
  steps: TourStep[];
}

export const FEATURE_TOURS: FeatureTour[] = [
  {
    id: "dashboard-welcome",
    name: "Welcome to Keepr",
    description: "A quick overview of your dashboard",
    version: 1,
    trigger: "first_login",
    steps: [
      {
        id: "welcome",
        title: "Welcome to Your Dashboard!",
        content:
          "This is your command center for managing reservations, guests, and your campground. Let's take a quick tour.",
        placement: "center",
      },
      {
        id: "nav-calendar",
        title: "Calendar View",
        content:
          "See all your reservations at a glance. Drag to create new bookings, click to edit existing ones.",
        target: "[data-tour='nav-calendar']",
        placement: "right",
        action: {
          label: "Open Calendar",
          href: "/calendar",
        },
      },
      {
        id: "nav-reservations",
        title: "Reservations",
        content:
          "Manage all your bookings here. Search, filter, and handle check-ins and check-outs.",
        target: "[data-tour='nav-reservations']",
        placement: "right",
      },
      {
        id: "quick-actions",
        title: "Quick Actions",
        content: "Use these shortcuts to create new bookings, add guests, or run reports quickly.",
        target: "[data-tour='quick-actions']",
        placement: "bottom",
      },
      {
        id: "help-support",
        title: "Need Help?",
        content:
          "Click the support button anytime to chat with our AI assistant or access the Help Center.",
        target: "[data-tour='help-button']",
        placement: "left",
      },
    ],
  },
  {
    id: "booking-flow",
    name: "Create Your First Booking",
    description: "Learn how to create reservations",
    version: 1,
    trigger: "manual",
    steps: [
      {
        id: "start",
        title: "Creating a Booking",
        content: "Let's walk through creating a reservation step by step.",
        placement: "center",
      },
      {
        id: "select-dates",
        title: "Select Dates",
        content:
          "Choose arrival and departure dates. The calendar shows availability in real-time.",
        target: "[data-tour='date-picker']",
        placement: "bottom",
      },
      {
        id: "choose-site",
        title: "Choose a Site",
        content: "Pick from available sites. You'll see pricing and amenities for each option.",
        target: "[data-tour='site-selector']",
        placement: "right",
      },
      {
        id: "guest-info",
        title: "Guest Information",
        content: "Enter guest details or search for returning guests. Their info will auto-fill.",
        target: "[data-tour='guest-form']",
        placement: "top",
      },
      {
        id: "payment",
        title: "Collect Payment",
        content: "Collect deposit or full payment. Stripe handles card processing securely.",
        target: "[data-tour='payment-section']",
        placement: "top",
      },
    ],
  },
  {
    id: "pricing-setup",
    name: "Set Up Your Pricing",
    description: "Configure rates and seasonal pricing",
    version: 1,
    trigger: "manual",
    steps: [
      {
        id: "intro",
        title: "Pricing Made Easy",
        content: "Set up base rates and let the system handle seasonal adjustments automatically.",
        placement: "center",
      },
      {
        id: "base-rate",
        title: "Base Rates",
        content: "Start with your standard nightly rate. This is your foundation for all pricing.",
        target: "[data-tour='base-rate']",
        placement: "right",
      },
      {
        id: "seasonal",
        title: "Seasonal Rules",
        content:
          "Add rules for peak season, holidays, or slow periods. Stack multiple rules for complex pricing.",
        target: "[data-tour='seasonal-rules']",
        placement: "right",
      },
      {
        id: "preview",
        title: "Preview Prices",
        content: "Always preview the final price before saving. See exactly what guests will pay.",
        target: "[data-tour='price-preview']",
        placement: "left",
      },
    ],
  },
  {
    id: "referral-program",
    name: "Earn with Referrals",
    description: "Learn about the referral program",
    version: 1,
    trigger: "manual",
    steps: [
      {
        id: "intro",
        title: "Refer & Earn $50",
        content:
          "Know other campground owners? Refer them to Keepr and you both get $50 in credits!",
        placement: "center",
      },
      {
        id: "share-link",
        title: "Your Unique Link",
        content: "Copy your referral link and share it with fellow campground owners.",
        target: "[data-tour='referral-link']",
        placement: "bottom",
      },
      {
        id: "track-progress",
        title: "Track Your Referrals",
        content: "See who clicked, signed up, and when you've earned credits.",
        target: "[data-tour='referral-stats']",
        placement: "bottom",
      },
    ],
  },
];

/**
 * Get a tour by ID
 */
export function getTour(tourId: string): FeatureTour | undefined {
  return FEATURE_TOURS.find((t) => t.id === tourId);
}

/**
 * Get tours that should auto-start for first login
 */
export function getFirstLoginTours(): FeatureTour[] {
  return FEATURE_TOURS.filter((t) => t.trigger === "first_login");
}

/**
 * Check if a tour has been completed (by version)
 */
export function isTourCompleted(tourId: string): boolean {
  if (typeof window === "undefined") return false;

  const tour = getTour(tourId);
  if (!tour) return false;

  const completedVersion = localStorage.getItem(`campreserv:tour:${tourId}`);
  return completedVersion ? parseInt(completedVersion) >= tour.version : false;
}

/**
 * Mark a tour as completed
 */
export function markTourCompleted(tourId: string): void {
  if (typeof window === "undefined") return;

  const tour = getTour(tourId);
  if (!tour) return;

  localStorage.setItem(`campreserv:tour:${tourId}`, String(tour.version));
}

/**
 * Reset tour completion (for re-showing after updates)
 */
export function resetTourCompletion(tourId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`campreserv:tour:${tourId}`);
}
