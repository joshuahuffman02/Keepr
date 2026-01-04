/**
 * Conversational copy with Disney-inspired magical language.
 * Use these throughout the app for consistent personality that makes
 * users feel like they're having a Disneyland experience.
 */

export const conversationalCopy = {
  // Form labels - friendly and inviting
  labels: {
    search: "Begin Your Adventure",
    location: "Where will your story unfold?",
    checkIn: "Your journey begins",
    checkOut: "Until next time",
    guests: "Adventurers",
    adults: "Adults",
    children: "Little Explorers",
    infants: "Tiny Travelers",
    pets: "Furry Companions",
    email: "Your Email",
    password: "Your Secret Password",
    name: "What should we call you?",
    phone: "How to reach you",
  },

  // Button text - action-oriented and magical
  buttons: {
    search: "Begin Your Adventure",
    book: "Reserve Your Adventure",
    bookNow: "Claim This Magical Spot",
    continue: "Continue Your Journey",
    next: "Onward",
    back: "Go Back",
    cancel: "Maybe Next Time",
    confirm: "Make It Happen",
    save: "Save Your Changes",
    submit: "Send It Off",
    signIn: "Welcome Back, Explorer",
    signUp: "Start Your Adventure",
    signOut: "Until We Meet Again",
    viewMore: "Discover More Treasures",
    viewAll: "See All Adventures",
    learnMore: "Uncover the Magic",
    getStarted: "Begin the Journey",
    tryItFree: "Start Your Free Adventure",
    contactUs: "Say Hello",
    loadMore: "Discover More Treasures",
    clearFilters: "Start Fresh",
    explore: "Begin Your Adventure",
    wishlistAdd: "Save to My Adventures",
    wishlistRemove: "Remove from Adventures",
  },

  // Loading states - build anticipation
  loading: {
    default: "Preparing something wonderful...",
    search: "Searching far and wide for your perfect escape...",
    booking: "Securing your spot in paradise...",
    payment: "Working some magic on your payment...",
    profile: "Gathering your adventure details...",
    campgrounds: "Discovering hidden gems...",
    reviews: "Collecting campfire stories...",
    photos: "Curating adventure memories...",
    map: "Charting unexplored territory...",
    availability: "Checking for openings...",
  },

  // Success messages - celebrate the moment
  success: {
    booking: "Your adventure is booked! The wilderness awaits.",
    payment: "Payment complete. Start packing!",
    review: "Your story has been shared! Thank you, adventurer.",
    profile: "Profile updated. Looking good, explorer!",
    wishlist: "Added to your adventure wishlist!",
    wishlistRemove: "Removed from your wishlist",
    message: "Message sent! We'll be in touch soon.",
    signIn: "Welcome back! Your adventures await.",
    signUp: "Welcome to the family, explorer!",
    saved: "Saved for your next adventure!",
  },

  // Error messages - helpful and encouraging
  errors: {
    generic: "Oops! A wild error appeared. Let's try that again.",
    network: "Looks like you wandered out of signal range. Check your connection.",
    notFound: "Even our best scouts couldn't find that trail.",
    unauthorized: "This adventure requires signing in first.",
    forbidden: "This trail is for authorized explorers only.",
    validation: "Let's double-check those details together.",
    payment: "The payment fairy needs another try. Check your details.",
    booking: "This spot was just claimed by another adventurer. Let's find you another!",
    timeout: "The request took longer than expected. Want to try again?",
  },

  // Empty states - inspire action
  empty: {
    search: "Even our best scouts came up empty... but new adventures await!",
    searchHint: "Try adjusting your search or exploring different destinations.",
    wishlist: "Your adventure wishlist is waiting to be filled!",
    wishlistHint: "Tap the heart on any campground to save it here.",
    reservations: "No adventures booked yet. The wilderness is calling!",
    reservationsHint: "Find your next escape and make some memories.",
    reviews: "Be the first to share your campfire story!",
    reviewsHint: "Your experience could inspire the next adventurer.",
    messages: "Your inbox is enjoying the peaceful silence.",
    notifications: "All caught up! Time to plan your next adventure.",
    noResults: "No treasures found here... yet!",
    noResultsHint: "Let's explore in a different direction.",
  },

  // Placeholders - guide and inspire
  placeholders: {
    search: "Where will your next adventure take you?",
    location: "Mountains, beaches, forests...",
    email: "your.email@adventure.com",
    phone: "(555) 123-4567",
    review: "Share the magic of your adventure...",
    message: "What's on your mind, explorer?",
    name: "Your name",
    date: "Choose your adventure dates",
  },

  // Dates and times - playful
  dates: {
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeekend: "This Weekend",
    nextWeekend: "Next Weekend",
    flexible: "I'm Flexible",
    nights: (n: number) => `${n} night${n === 1 ? "" : "s"} of adventure`,
    guests: (n: number) => `${n} adventurer${n === 1 ? "" : "s"}`,
  },

  // Time-of-day greetings - create atmosphere
  greetings: {
    morning: "Rise and shine, explorer!",
    afternoon: "Perfect afternoon for adventure planning!",
    evening: "Dreaming of campfires tonight?",
    night: "Night owls plan the best adventures",
    welcome: "Welcome back, explorer!",
    goodbye: "Happy trails until next time!",
    firstVisit: "Welcome to Keepr!",
    returning: "Great to see you again!",
  },

  // Micro-copy for UI elements
  micro: {
    perNight: "per night",
    totalFor: "total for",
    startingAt: "Adventure starts at",
    priceFrom: "from",
    verified: "Verified Host",
    superhost: "Superhost",
    instantBook: "Book Instantly",
    bestSeller: "Popular Adventure",
    rareFind: "Hidden Gem",
    lastMinute: "Last Chance",
    trending: "Trending Now",
    new: "New Discovery",
    featured: "Staff Pick",
    bookable: "Ready to Book",
    external: "View Details",
    rating: (r: number) => `${r.toFixed(1)} from happy campers`,
    reviews: (n: number) => `${n} campfire ${n === 1 ? "story" : "stories"}`,
    justBooked: "Just booked!",
    almostGone: "Only a few spots left!",
    peopleViewing: (n: number) => `${n} adventurer${n === 1 ? " is" : "s are"} looking at this`,
  },

  // Tooltips and hints
  tooltips: {
    cardHover: "This could be your next memory",
    wishlistHover: "Save for later adventures",
    shareHover: "Share this discovery",
    scrollMore: "Keep scrolling, explorer!",
    scrollTop: "Back to the summit",
    filters: "Refine your adventure",
    sort: "Sort your discoveries",
  },

  // Celebration messages
  celebrations: {
    scrollMilestone25: "Keep exploring!",
    scrollMilestone50: "Halfway there, adventurer!",
    scrollMilestone100: "You explored it all!",
    firstBooking: "Your first adventure awaits!",
    returningGuest: "Welcome back, valued explorer!",
    achievement: "Achievement unlocked!",
  },

  // Call to action copy
  cta: {
    bookNow: "Begin Your Adventure",
    viewDetails: "Explore This Escape",
    checkAvailability: "Find Available Dates",
    contactHost: "Ask the Host",
    writeReview: "Share Your Story",
    seePhotos: "View the Magic",
    getDirections: "Chart Your Course",
  },
};

// Helper function to get a copy value with fallback
export function getCopy<
  T extends keyof typeof conversationalCopy,
  K extends keyof (typeof conversationalCopy)[T]
>(category: T, key: K): string {
  const value = conversationalCopy[category]?.[key];
  if (typeof value === "function") {
    return value.toString();
  }
  return (value as string) || String(key);
}

// Type-safe helper for getting loading messages
export function getLoadingMessage(
  context: keyof typeof conversationalCopy.loading = "default"
): string {
  return conversationalCopy.loading[context] || conversationalCopy.loading.default;
}

// Type-safe helper for getting error messages
export function getErrorMessage(
  type: keyof typeof conversationalCopy.errors = "generic"
): string {
  return conversationalCopy.errors[type] || conversationalCopy.errors.generic;
}

// Get empty state message with hint
export function getEmptyState(
  type: keyof typeof conversationalCopy.empty
): { message: string; hint?: string } {
  const message = conversationalCopy.empty[type] || conversationalCopy.empty.noResults;
  const hintKey = `${type}Hint` as keyof typeof conversationalCopy.empty;
  const hint = conversationalCopy.empty[hintKey] || conversationalCopy.empty.noResultsHint;
  return { message, hint };
}

// Get a celebration message for scroll milestones
export function getScrollCelebration(
  percentage: number
): string | null {
  if (percentage >= 100) return conversationalCopy.celebrations.scrollMilestone100;
  if (percentage >= 50) return conversationalCopy.celebrations.scrollMilestone50;
  if (percentage >= 25) return conversationalCopy.celebrations.scrollMilestone25;
  return null;
}

// Time-aware greeting
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return conversationalCopy.greetings.morning;
  if (hour >= 12 && hour < 17) return conversationalCopy.greetings.afternoon;
  if (hour >= 17 && hour < 21) return conversationalCopy.greetings.evening;
  return conversationalCopy.greetings.night;
}
