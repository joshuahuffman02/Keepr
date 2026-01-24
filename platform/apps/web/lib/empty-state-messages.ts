export type EmptyStateContext =
  | "search-no-results"
  | "reviews-none"
  | "wishlist-empty"
  | "reservations-none"
  | "messages-none"
  | "notifications-none"
  | "photos-none"
  | "payments-none"
  | "guests-none"
  | "sites-none"
  | "campgrounds-none";

export interface EmptyStateMessage {
  title: string;
  description: string;
  icon: string; // Path to clay icon
  actionLabel?: string;
  actionHref?: string;
}

export const emptyStateMessages: Record<EmptyStateContext, EmptyStateMessage> = {
  "search-no-results": {
    title: "Even our best scouts came up empty",
    description:
      "Try adjusting your search or exploring a different area. Sometimes the best campgrounds are just a filter away.",
    icon: "/images/icons/confused-compass.png",
    actionLabel: "Clear Filters",
  },
  "reviews-none": {
    title: "Be the first to share your campfire stories",
    description:
      "Your experience could help fellow campers find their perfect spot. Every adventure deserves to be told.",
    icon: "/images/icons/campfire.png",
    actionLabel: "Write a Review",
  },
  "wishlist-empty": {
    title: "Your adventure bucket list is waiting",
    description:
      "Save campgrounds you love by tapping the heart icon. Start building your dream camping itinerary.",
    icon: "/images/icons/lonely-tent.png",
    actionLabel: "Explore Campgrounds",
    actionHref: "/",
  },
  "reservations-none": {
    title: "Your camping calendar is wide open",
    description:
      "No upcoming trips yet, but the great outdoors is calling. Ready to plan your next adventure?",
    icon: "/images/icons/bouncing-tent.png",
    actionLabel: "Find a Campground",
    actionHref: "/",
  },
  "messages-none": {
    title: "Your inbox is enjoying the silence",
    description:
      "Messages from campgrounds will appear here. Book a stay to start the conversation.",
    icon: "/images/icons/support.png",
  },
  "notifications-none": {
    title: "All caught up!",
    description:
      "No new notifications. We'll let you know when something exciting happens with your reservations.",
    icon: "/images/icons/instant-confirm.png",
  },
  "photos-none": {
    title: "No photos yet",
    description:
      "Photos from your adventures will appear here. The best memories deserve to be captured.",
    icon: "/images/icons/hero/sun.png",
  },
  "payments-none": {
    title: "No payment history",
    description: "Your payment records will appear here once you make your first booking.",
    icon: "/images/icons/best-price.png",
  },
  "guests-none": {
    title: "No guests yet",
    description: "Guest information will appear here as reservations come in.",
    icon: "/images/icons/guests.png",
  },
  "sites-none": {
    title: "No sites configured",
    description: "Add your first campsite to start accepting reservations.",
    icon: "/images/icons/bouncing-tent.png",
    actionLabel: "Add Site",
  },
  "campgrounds-none": {
    title: "No campgrounds found",
    description: "Campgrounds will appear here. Check back soon or adjust your search.",
    icon: "/images/icons/confused-compass.png",
  },
};

// Get message for a context with fallback
export function getEmptyStateMessage(context: EmptyStateContext): EmptyStateMessage {
  return emptyStateMessages[context] || emptyStateMessages["search-no-results"];
}

// Alternative messages for variety
export const alternativeEmptyMessages: Partial<Record<EmptyStateContext, string[]>> = {
  "search-no-results": [
    "The trail went cold on this search",
    "Hmm, nothing here but tumbleweeds",
    "Our compasses are confused too",
  ],
  "wishlist-empty": [
    "Your wishlist is feeling lonely",
    "No favorites yet? Time to explore!",
    "Save your dream destinations here",
  ],
  "reservations-none": [
    "Your next adventure awaits",
    "Time to hit the trail?",
    "The campfire is waiting for you",
  ],
};
