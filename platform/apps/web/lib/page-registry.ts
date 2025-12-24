/**
 * Page Registry - Centralized definition of all pages in the application
 * Used for customizable sidebar menu, command palette search, and "All Pages" discovery
 */

export type PageCategory =
  | "operations"
  | "guests"
  | "finance"
  | "marketing"
  | "reports"
  | "settings"
  | "admin"
  | "store"
  | "staff";

export interface PageDefinition {
  href: string;
  label: string;
  icon: string;
  category: PageCategory;
  description: string;
  keywords: string[];
  permissions?: string[]; // Required permissions to access
  defaultForRoles?: string[]; // Include in default menu for these roles
  dynamic?: boolean; // Contains dynamic segments like [campgroundId]
}

/**
 * All pages in the application
 * Dynamic pages use placeholders that get replaced at runtime
 */
export const PAGE_REGISTRY: PageDefinition[] = [
  // ============================================
  // OPERATIONS - Daily front desk operations
  // ============================================
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    category: "operations",
    description: "Overview of your campground operations",
    keywords: ["home", "overview", "summary", "stats"],
    defaultForRoles: ["front_desk", "manager", "owner", "admin"],
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: "calendar",
    category: "operations",
    description: "Visual reservation calendar",
    keywords: ["schedule", "availability", "dates", "booking grid"],
    defaultForRoles: ["front_desk", "manager", "owner", "admin"],
  },
  {
    href: "/check-in-out",
    label: "Check In/Out",
    icon: "reservation",
    category: "operations",
    description: "Process arrivals and departures",
    keywords: ["arrivals", "departures", "front desk", "check in", "check out"],
    defaultForRoles: ["front_desk", "manager"],
  },
  {
    href: "/booking",
    label: "New Booking",
    icon: "plus",
    category: "operations",
    description: "Create a new reservation",
    keywords: ["reserve", "book", "new reservation", "add booking"],
    defaultForRoles: ["front_desk", "manager"],
  },
  {
    href: "/reservations",
    label: "Reservations",
    icon: "reservation",
    category: "operations",
    description: "View and manage all reservations",
    keywords: ["bookings", "stays", "reservations list"],
    defaultForRoles: ["front_desk", "manager", "owner"],
  },
  {
    href: "/waitlist",
    label: "Waitlist",
    icon: "clock",
    category: "operations",
    description: "Manage guests waiting for availability",
    keywords: ["queue", "waiting list", "interested guests"],
    defaultForRoles: ["front_desk"],
  },
  {
    href: "/messages",
    label: "Messages",
    icon: "message",
    category: "operations",
    description: "Guest communication center",
    keywords: ["chat", "inbox", "communications", "email", "sms"],
    defaultForRoles: ["front_desk", "manager", "owner"],
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: "wrench",
    category: "operations",
    description: "Track and manage maintenance tasks",
    keywords: ["repairs", "work orders", "issues", "fix"],
    defaultForRoles: ["maintenance"],
  },
  {
    href: "/pos",
    label: "Point of Sale",
    icon: "payments",
    category: "operations",
    description: "Process in-person sales",
    keywords: ["register", "checkout", "sell", "store", "retail"],
    defaultForRoles: ["front_desk"],
  },
  {
    href: "/activities",
    label: "Activities",
    icon: "sparkles",
    category: "operations",
    description: "Manage park activities and events",
    keywords: ["events", "programs", "things to do"],
  },
  {
    href: "/events",
    label: "Events",
    icon: "calendar",
    category: "operations",
    description: "Schedule and manage events",
    keywords: ["activities", "programs", "gatherings"],
  },
  {
    href: "/groups",
    label: "Group Bookings",
    icon: "users",
    category: "operations",
    description: "Manage group reservations",
    keywords: ["bulk booking", "rally", "club", "organization"],
  },
  {
    href: "/incidents",
    label: "Incidents",
    icon: "alert",
    category: "operations",
    description: "Log and track incidents",
    keywords: ["accident", "report", "safety", "issue"],
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: "policy",
    category: "operations",
    description: "Review pending approvals",
    keywords: ["approve", "requests", "pending"],
    permissions: ["approvalsRead"],
  },

  // ============================================
  // GUESTS - Guest management
  // ============================================
  {
    href: "/guests",
    label: "Guests",
    icon: "guest",
    category: "guests",
    description: "Guest database and profiles",
    keywords: ["customers", "campers", "visitors", "contacts"],
    defaultForRoles: ["front_desk", "manager", "owner"],
  },
  {
    href: "/reviews",
    label: "Reviews",
    icon: "star",
    category: "guests",
    description: "View and manage guest reviews",
    keywords: ["feedback", "ratings", "testimonials"],
  },
  {
    href: "/tickets",
    label: "Support Tickets",
    icon: "ticket",
    category: "guests",
    description: "Guest support requests",
    keywords: ["help", "issues", "requests", "complaints"],
  },

  // ============================================
  // FINANCE - Financial management
  // ============================================
  {
    href: "/ledger",
    label: "Ledger",
    icon: "ledger",
    category: "finance",
    description: "Financial transactions and accounting",
    keywords: ["accounting", "transactions", "money", "payments"],
    defaultForRoles: ["manager", "owner", "finance"],
    permissions: ["financeRead"],
  },
  {
    href: "/payouts",
    label: "Payouts",
    icon: "payments",
    category: "finance",
    description: "Track and manage payouts",
    keywords: ["deposits", "bank transfers", "payments received"],
    permissions: ["financeRead"],
  },
  {
    href: "/disputes",
    label: "Disputes",
    icon: "alert",
    category: "finance",
    description: "Manage payment disputes and chargebacks",
    keywords: ["chargebacks", "refunds", "claims"],
    permissions: ["financeRead"],
  },
  {
    href: "/gift-cards",
    label: "Gift Cards",
    icon: "tag",
    category: "finance",
    description: "Manage gift cards and stored value",
    keywords: ["gift certificates", "vouchers", "credits"],
  },
  {
    href: "/finance",
    label: "Finance Hub",
    icon: "pricing",
    category: "finance",
    description: "Financial overview and management",
    keywords: ["money", "revenue", "accounting"],
    permissions: ["financeRead"],
  },
  {
    href: "/finance/payouts",
    label: "Payout History",
    icon: "payments",
    category: "finance",
    description: "View all payout records",
    keywords: ["deposits", "bank", "transfer history"],
    permissions: ["financeRead"],
  },
  {
    href: "/finance/disputes",
    label: "Dispute Center",
    icon: "alert",
    category: "finance",
    description: "Handle disputes and chargebacks",
    keywords: ["chargebacks", "claims", "resolve"],
    permissions: ["financeRead"],
  },
  {
    href: "/billing/repeat-charges",
    label: "Repeat Charges",
    icon: "clock",
    category: "finance",
    description: "Manage recurring billing",
    keywords: ["subscriptions", "recurring", "autopay"],
    permissions: ["financeRead"],
  },

  // ============================================
  // REPORTS - Analytics and reporting
  // ============================================
  {
    href: "/reports",
    label: "Reports",
    icon: "reports",
    category: "reports",
    description: "Business intelligence and reports",
    keywords: ["analytics", "insights", "data", "metrics"],
    defaultForRoles: ["manager", "owner", "admin"],
    permissions: ["reportsRead"],
  },
  {
    href: "/reports/saved",
    label: "Saved Reports",
    icon: "reports",
    category: "reports",
    description: "Your saved report configurations",
    keywords: ["custom reports", "favorites"],
    permissions: ["reportsRead"],
  },
  {
    href: "/reports/audit",
    label: "Audit Log",
    icon: "audit",
    category: "reports",
    description: "System activity audit trail",
    keywords: ["logs", "history", "changes", "tracking"],
    permissions: ["reportsRead"],
  },
  {
    href: "/reports/portfolio",
    label: "Portfolio Reports",
    icon: "reports",
    category: "reports",
    description: "Multi-property reporting",
    keywords: ["comparison", "multi-site", "chain"],
    permissions: ["reportsRead"],
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: "reports",
    category: "reports",
    description: "Deep dive analytics",
    keywords: ["charts", "graphs", "trends"],
    permissions: ["reportsRead"],
  },
  {
    href: "/gamification",
    label: "Gamification",
    icon: "trophy",
    category: "reports",
    description: "Staff leaderboards and achievements",
    keywords: ["leaderboard", "rewards", "points", "xp"],
    defaultForRoles: ["manager", "owner"],
  },

  // ============================================
  // MARKETING - Marketing and promotions
  // ============================================
  {
    href: "/marketing",
    label: "Marketing Hub",
    icon: "megaphone",
    category: "marketing",
    description: "Marketing campaigns and tools",
    keywords: ["advertising", "promotion", "outreach"],
  },
  {
    href: "/marketing/promotions",
    label: "Promotions",
    icon: "tag",
    category: "marketing",
    description: "Create and manage promotions",
    keywords: ["discounts", "coupons", "deals", "offers"],
  },
  {
    href: "/social-planner",
    label: "Social Planner",
    icon: "megaphone",
    category: "marketing",
    description: "Plan social media content",
    keywords: ["facebook", "instagram", "posts", "social media"],
  },
  {
    href: "/social-planner/calendar",
    label: "Social Calendar",
    icon: "calendar",
    category: "marketing",
    description: "Schedule social posts",
    keywords: ["post schedule", "content calendar"],
  },
  {
    href: "/social-planner/content-bank",
    label: "Content Bank",
    icon: "form",
    category: "marketing",
    description: "Saved content and templates",
    keywords: ["library", "assets", "photos", "videos"],
  },
  {
    href: "/ota",
    label: "OTA Channels",
    icon: "brand",
    category: "marketing",
    description: "Online travel agency integrations",
    keywords: ["booking.com", "expedia", "airbnb", "channels"],
  },

  // ============================================
  // STORE - Retail and inventory
  // ============================================
  {
    href: "/store",
    label: "Store",
    icon: "payments",
    category: "store",
    description: "Manage your camp store",
    keywords: ["retail", "merchandise", "products"],
  },
  {
    href: "/store/orders",
    label: "Store Orders",
    icon: "reservation",
    category: "store",
    description: "View and process orders",
    keywords: ["purchases", "sales", "fulfillment"],
  },
  {
    href: "/store/locations",
    label: "Store Locations",
    icon: "camp",
    category: "store",
    description: "Manage store locations",
    keywords: ["outlets", "shops", "retail locations"],
  },
  {
    href: "/store/fulfillment",
    label: "Fulfillment",
    icon: "wrench",
    category: "store",
    description: "Order fulfillment queue",
    keywords: ["shipping", "delivery", "pick up"],
  },
  {
    href: "/store/transfers",
    label: "Inventory Transfers",
    icon: "form",
    category: "store",
    description: "Transfer stock between locations",
    keywords: ["move inventory", "stock transfer"],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: "form",
    category: "store",
    description: "Manage product inventory",
    keywords: ["stock", "products", "items"],
  },

  // ============================================
  // STAFF - Staff management
  // ============================================
  {
    href: "/operations/tasks",
    label: "Staff Tasks",
    icon: "wrench",
    category: "staff",
    description: "Assign and track staff tasks",
    keywords: ["todos", "assignments", "work"],
    permissions: ["operationsWrite"],
  },
  {
    href: "/operations/rentals",
    label: "Rentals",
    icon: "camp",
    category: "staff",
    description: "Manage rental equipment",
    keywords: ["bikes", "kayaks", "golf carts"],
    permissions: ["operationsWrite"],
  },

  // ============================================
  // DISCOVERY & HELP
  // ============================================
  {
    href: "/features",
    label: "Feature Discovery",
    icon: "sparkles",
    category: "settings",
    description: "Explore and track all available features",
    keywords: ["checklist", "discovery", "explore", "learn", "tour"],
  },
  {
    href: "/all-pages",
    label: "All Pages",
    icon: "dashboard",
    category: "settings",
    description: "Browse all available pages",
    keywords: ["navigation", "menu", "browse", "find"],
  },

  // ============================================
  // SETTINGS - Configuration pages
  // ============================================
  {
    href: "/dashboard/settings",
    label: "Settings Hub",
    icon: "policy",
    category: "settings",
    description: "All settings and configuration",
    keywords: ["configure", "preferences", "options"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/branding",
    label: "Branding",
    icon: "brand",
    category: "settings",
    description: "Logo, colors, and brand identity",
    keywords: ["logo", "colors", "theme", "appearance"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/payments",
    label: "Payment Settings",
    icon: "payments",
    category: "settings",
    description: "Configure payment processing",
    keywords: ["stripe", "credit cards", "billing"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/tax-rules",
    label: "Tax Rules",
    icon: "pricing",
    category: "settings",
    description: "Configure tax rates and rules",
    keywords: ["taxes", "lodging tax", "sales tax"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/pricing-rules",
    label: "Pricing Rules",
    icon: "pricing",
    category: "settings",
    description: "Dynamic pricing and rate rules",
    keywords: ["rates", "pricing", "fees"],
    permissions: ["pricingWrite"],
  },
  {
    href: "/dashboard/settings/seasonal-rates",
    label: "Seasonal Rates",
    icon: "calendar",
    category: "settings",
    description: "Configure seasonal rate periods",
    keywords: ["peak", "off-season", "holiday rates"],
    permissions: ["pricingWrite"],
  },
  {
    href: "/dashboard/settings/deposit-policies",
    label: "Deposit Policies",
    icon: "payments",
    category: "settings",
    description: "Configure deposit requirements",
    keywords: ["deposits", "upfront payment", "booking payment"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/policies",
    label: "Policies",
    icon: "policy",
    category: "settings",
    description: "Cancellation and booking policies",
    keywords: ["rules", "terms", "conditions"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/upsells",
    label: "Upsells & Add-ons",
    icon: "tag",
    category: "settings",
    description: "Configure booking add-ons",
    keywords: ["extras", "upgrades", "add-ons"],
    permissions: ["pricingWrite"],
  },
  {
    href: "/dashboard/settings/users",
    label: "Team Members",
    icon: "users",
    category: "settings",
    description: "Manage staff accounts",
    keywords: ["employees", "staff", "users", "team"],
    permissions: ["usersWrite"],
  },
  {
    href: "/dashboard/settings/permissions",
    label: "Permissions",
    icon: "lock",
    category: "settings",
    description: "Configure role permissions",
    keywords: ["access", "roles", "security"],
    permissions: ["usersWrite"],
  },
  {
    href: "/dashboard/settings/access-control",
    label: "Access Control",
    icon: "lock",
    category: "settings",
    description: "Advanced access rules",
    keywords: ["restrictions", "security", "gates"],
    permissions: ["usersWrite"],
  },
  {
    href: "/dashboard/settings/communications",
    label: "Communications",
    icon: "message",
    category: "settings",
    description: "Email and SMS settings",
    keywords: ["email", "sms", "notifications"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/templates",
    label: "Email Templates",
    icon: "form",
    category: "settings",
    description: "Customize email templates",
    keywords: ["confirmation", "reminder", "email design"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/notification-triggers",
    label: "Notification Triggers",
    icon: "alert",
    category: "settings",
    description: "Configure automated notifications",
    keywords: ["automation", "triggers", "alerts"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/integrations",
    label: "Integrations",
    icon: "brand",
    category: "settings",
    description: "Third-party integrations",
    keywords: ["connect", "apps", "api", "sync"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/webhooks",
    label: "Webhooks",
    icon: "brand",
    category: "settings",
    description: "Configure webhook endpoints",
    keywords: ["api", "automation", "events"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/developer",
    label: "Developer",
    icon: "brand",
    category: "settings",
    description: "API keys and developer tools",
    keywords: ["api", "keys", "tokens"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/import",
    label: "Import Data",
    icon: "form",
    category: "settings",
    description: "Import data from other systems",
    keywords: ["csv", "migrate", "upload"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/photos",
    label: "Photos",
    icon: "brand",
    category: "settings",
    description: "Manage campground photos",
    keywords: ["images", "gallery", "media"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/faqs",
    label: "FAQs",
    icon: "form",
    category: "settings",
    description: "Frequently asked questions",
    keywords: ["help", "questions", "answers"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/blackout-dates",
    label: "Blackout Dates",
    icon: "calendar",
    category: "settings",
    description: "Block dates from booking",
    keywords: ["unavailable", "closed", "blocked"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/promotions",
    label: "Promotion Codes",
    icon: "tag",
    category: "settings",
    description: "Manage discount codes",
    keywords: ["coupons", "promo codes", "discounts"],
    permissions: ["pricingWrite"],
  },
  {
    href: "/dashboard/settings/memberships",
    label: "Memberships",
    icon: "users",
    category: "settings",
    description: "Membership program settings",
    keywords: ["loyalty", "members", "club"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/gamification",
    label: "Gamification Settings",
    icon: "trophy",
    category: "settings",
    description: "Configure XP and rewards",
    keywords: ["points", "badges", "leaderboard"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/ota",
    label: "OTA Settings",
    icon: "brand",
    category: "settings",
    description: "Online travel agency settings",
    keywords: ["channels", "booking.com", "expedia"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/store-hours",
    label: "Store Hours",
    icon: "clock",
    category: "settings",
    description: "Configure business hours",
    keywords: ["hours", "schedule", "open", "close"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/security",
    label: "Security",
    icon: "lock",
    category: "settings",
    description: "Security and authentication settings",
    keywords: ["password", "2fa", "security"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/privacy",
    label: "Privacy",
    icon: "lock",
    category: "settings",
    description: "Privacy and data settings",
    keywords: ["gdpr", "data", "consent"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/localization",
    label: "Localization",
    icon: "brand",
    category: "settings",
    description: "Language and regional settings",
    keywords: ["language", "timezone", "currency"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/billing",
    label: "Subscription",
    icon: "payments",
    category: "settings",
    description: "Manage your subscription",
    keywords: ["plan", "billing", "invoice"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/campaigns",
    label: "Email Campaigns",
    icon: "megaphone",
    category: "settings",
    description: "Marketing email campaigns",
    keywords: ["newsletters", "marketing", "bulk email"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/jobs",
    label: "Background Jobs",
    icon: "clock",
    category: "settings",
    description: "View background job status",
    keywords: ["queue", "tasks", "processing"],
    permissions: ["settingsWrite"],
  },
  {
    href: "/dashboard/settings/analytics",
    label: "Analytics Settings",
    icon: "reports",
    category: "settings",
    description: "Configure analytics tracking",
    keywords: ["tracking", "google analytics", "pixels"],
    permissions: ["settingsWrite"],
  },

  // ============================================
  // MANAGEMENT - Campground management pages
  // ============================================
  {
    href: "/dashboard/management",
    label: "Management Hub",
    icon: "wrench",
    category: "operations",
    description: "Inventory, sites, and configuration",
    keywords: ["manage", "configure", "setup"],
    permissions: ["operationsWrite"],
  },
  {
    href: "/campgrounds",
    label: "Campgrounds",
    icon: "camp",
    category: "operations",
    description: "View all your properties",
    keywords: ["properties", "parks", "locations"],
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: "reports",
    category: "operations",
    description: "Multi-property overview",
    keywords: ["properties", "chain", "multi-site"],
  },
  {
    href: "/forms",
    label: "Forms",
    icon: "form",
    category: "operations",
    description: "Custom forms and surveys",
    keywords: ["surveys", "questionnaires", "intake"],
  },
  {
    href: "/kiosk",
    label: "Kiosk Mode",
    icon: "camp",
    category: "operations",
    description: "Self-service kiosk",
    keywords: ["self check-in", "self service"],
  },

  // ============================================
  // ADMIN - Platform administration
  // ============================================
  {
    href: "/admin",
    label: "Admin Dashboard",
    icon: "lock",
    category: "admin",
    description: "Platform administration",
    keywords: ["super admin", "platform"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/campgrounds",
    label: "All Campgrounds",
    icon: "camp",
    category: "admin",
    description: "Manage all campgrounds",
    keywords: ["properties", "all parks"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/platform/users",
    label: "Platform Users",
    icon: "users",
    category: "admin",
    description: "Manage platform users",
    keywords: ["accounts", "all users"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/support",
    label: "Support Queue",
    icon: "ticket",
    category: "admin",
    description: "Customer support tickets",
    keywords: ["help desk", "support requests"],
    permissions: ["supportRead"],
  },
  {
    href: "/admin/support/analytics",
    label: "Support Analytics",
    icon: "reports",
    category: "admin",
    description: "Support performance metrics",
    keywords: ["support stats", "response times"],
    permissions: ["supportAnalytics"],
  },
  {
    href: "/admin/analytics",
    label: "Platform Analytics",
    icon: "reports",
    category: "admin",
    description: "Platform-wide analytics",
    keywords: ["all metrics", "platform stats"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/system/flags",
    label: "Feature Flags",
    icon: "policy",
    category: "admin",
    description: "Manage feature flags",
    keywords: ["toggles", "features", "rollout"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/system/health",
    label: "System Health",
    icon: "alert",
    category: "admin",
    description: "System status and health",
    keywords: ["status", "uptime", "monitoring"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/system/audit",
    label: "Platform Audit",
    icon: "audit",
    category: "admin",
    description: "Platform-wide audit log",
    keywords: ["logs", "activity", "tracking"],
    permissions: ["platformAdmin"],
  },
  {
    href: "/admin/system/announcements",
    label: "Announcements",
    icon: "megaphone",
    category: "admin",
    description: "Platform announcements",
    keywords: ["notices", "alerts", "news"],
    permissions: ["platformAdmin"],
  },

  // ============================================
  // HELP - Help and documentation
  // ============================================
  {
    href: "/help",
    label: "Help Center",
    icon: "form",
    category: "operations",
    description: "Help and documentation",
    keywords: ["documentation", "support", "how to"],
  },
  {
    href: "/help/tutorials",
    label: "Tutorials",
    icon: "form",
    category: "operations",
    description: "Step-by-step tutorials",
    keywords: ["guides", "walkthroughs", "learn"],
  },
  {
    href: "/help/shortcuts",
    label: "Keyboard Shortcuts",
    icon: "form",
    category: "operations",
    description: "Keyboard shortcut reference",
    keywords: ["hotkeys", "commands", "quick keys"],
  },
  {
    href: "/help/changelog",
    label: "Changelog",
    icon: "form",
    category: "operations",
    description: "Recent updates and changes",
    keywords: ["updates", "new features", "releases"],
  },
  {
    href: "/help/faq",
    label: "FAQ",
    icon: "form",
    category: "operations",
    description: "Frequently asked questions",
    keywords: ["questions", "answers", "common issues"],
  },
];

/**
 * Dynamic page templates - these get campgroundId replaced at runtime
 */
export const DYNAMIC_PAGE_TEMPLATES: PageDefinition[] = [
  {
    href: "/campgrounds/[campgroundId]/sites",
    label: "Sites",
    icon: "camp",
    category: "operations",
    description: "Manage campground sites",
    keywords: ["sites", "units", "inventory"],
    dynamic: true,
  },
  {
    href: "/campgrounds/[campgroundId]/classes",
    label: "Site Classes",
    icon: "camp",
    category: "operations",
    description: "Site type categories",
    keywords: ["site types", "categories"],
    dynamic: true,
  },
  {
    href: "/campgrounds/[campgroundId]/map",
    label: "Site Map",
    icon: "camp",
    category: "operations",
    description: "Visual site map",
    keywords: ["map", "layout", "park map"],
    dynamic: true,
    defaultForRoles: ["front_desk", "manager", "owner"],
  },
  {
    href: "/campgrounds/[campgroundId]/housekeeping",
    label: "Housekeeping",
    icon: "wrench",
    category: "staff",
    description: "Housekeeping tasks and status",
    keywords: ["cleaning", "turnover", "ready"],
    dynamic: true,
  },
  {
    href: "/campgrounds/[campgroundId]/reservations",
    label: "Campground Reservations",
    icon: "reservation",
    category: "operations",
    description: "Reservations for this campground",
    keywords: ["bookings", "stays"],
    dynamic: true,
  },
  {
    href: "/campgrounds/[campgroundId]/staff/timeclock",
    label: "Time Clock",
    icon: "clock",
    category: "staff",
    description: "Staff time tracking",
    keywords: ["punch", "hours", "attendance"],
    dynamic: true,
    permissions: ["operationsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/staff/approvals",
    label: "Shift Approvals",
    icon: "users",
    category: "staff",
    description: "Approve staff shifts",
    keywords: ["timesheets", "hours approval"],
    dynamic: true,
    permissions: ["operationsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/staff/overrides",
    label: "Override Requests",
    icon: "alert",
    category: "staff",
    description: "Review time override requests",
    keywords: ["corrections", "adjustments"],
    dynamic: true,
    permissions: ["operationsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/staff-scheduling",
    label: "Staff Scheduling",
    icon: "calendar",
    category: "staff",
    description: "Schedule staff shifts",
    keywords: ["roster", "schedule", "shifts"],
    dynamic: true,
    permissions: ["operationsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/utilities-billing",
    label: "Utilities Billing",
    icon: "pricing",
    category: "finance",
    description: "Meter readings and utility billing",
    keywords: ["electric", "water", "metered"],
    dynamic: true,
    permissions: ["financeRead"],
  },
  {
    href: "/campgrounds/[campgroundId]/dynamic-pricing",
    label: "Dynamic Pricing",
    icon: "pricing",
    category: "settings",
    description: "AI-powered pricing optimization",
    keywords: ["smart pricing", "revenue management"],
    dynamic: true,
    permissions: ["pricingWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/groups",
    label: "Group Reservations",
    icon: "users",
    category: "operations",
    description: "Manage group bookings",
    keywords: ["rallies", "clubs", "bulk"],
    dynamic: true,
  },
  {
    href: "/campgrounds/[campgroundId]/workflows",
    label: "Workflows",
    icon: "form",
    category: "settings",
    description: "Automated workflow rules",
    keywords: ["automation", "rules", "triggers"],
    dynamic: true,
    permissions: ["settingsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/reports",
    label: "Campground Reports",
    icon: "reports",
    category: "reports",
    description: "Reports for this campground",
    keywords: ["analytics", "metrics"],
    dynamic: true,
    permissions: ["reportsRead"],
  },
  {
    href: "/campgrounds/[campgroundId]/settings",
    label: "Campground Settings",
    icon: "policy",
    category: "settings",
    description: "Settings for this campground",
    keywords: ["configure", "preferences"],
    dynamic: true,
    permissions: ["settingsWrite"],
  },
  {
    href: "/campgrounds/[campgroundId]/ai",
    label: "AI Assistant",
    icon: "sparkles",
    category: "operations",
    description: "AI-powered insights and suggestions",
    keywords: ["artificial intelligence", "recommendations"],
    dynamic: true,
  },
];

/**
 * Get pages resolved for a specific campground
 */
export function resolvePages(campgroundId: string | null): PageDefinition[] {
  const staticPages = [...PAGE_REGISTRY];

  if (campgroundId) {
    const dynamicPages = DYNAMIC_PAGE_TEMPLATES.map((page) => ({
      ...page,
      href: page.href.replace("[campgroundId]", campgroundId),
      dynamic: false,
    }));
    return [...staticPages, ...dynamicPages];
  }

  return staticPages;
}

/**
 * Get pages grouped by category
 */
export function getPagesByCategory(
  pages: PageDefinition[]
): Record<PageCategory, PageDefinition[]> {
  const grouped: Record<PageCategory, PageDefinition[]> = {
    operations: [],
    guests: [],
    finance: [],
    marketing: [],
    reports: [],
    settings: [],
    admin: [],
    store: [],
    staff: [],
  };

  for (const page of pages) {
    grouped[page.category].push(page);
  }

  return grouped;
}

/**
 * Category display information
 */
export const CATEGORY_INFO: Record<
  PageCategory,
  { label: string; description: string; icon: string }
> = {
  operations: {
    label: "Operations",
    description: "Daily front desk and campground operations",
    icon: "dashboard",
  },
  guests: {
    label: "Guests",
    description: "Guest management and communication",
    icon: "guest",
  },
  finance: {
    label: "Finance",
    description: "Payments, accounting, and financial reports",
    icon: "pricing",
  },
  marketing: {
    label: "Marketing",
    description: "Promotions, social media, and channels",
    icon: "megaphone",
  },
  reports: {
    label: "Reports",
    description: "Analytics, insights, and reporting",
    icon: "reports",
  },
  settings: {
    label: "Settings",
    description: "Configuration and preferences",
    icon: "policy",
  },
  admin: {
    label: "Administration",
    description: "Platform administration tools",
    icon: "lock",
  },
  store: {
    label: "Store",
    description: "Camp store and retail management",
    icon: "payments",
  },
  staff: {
    label: "Staff",
    description: "Staff management and scheduling",
    icon: "users",
  },
};

/**
 * Search pages by query
 */
export function searchPages(
  pages: PageDefinition[],
  query: string
): PageDefinition[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  return pages.filter((page) => {
    const searchText = [
      page.label,
      page.description,
      ...page.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return searchText.includes(lowerQuery);
  });
}
