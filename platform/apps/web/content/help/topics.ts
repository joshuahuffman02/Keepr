export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  category: string;
  roles?: string[];
  tags: string[];
  steps: string[];
  tips?: string[];
  links?: { label: string; href: string }[];
};

export const helpTopics: HelpTopic[] = [
  {
    id: "dashboard-overview",
    title: "Dashboard at a Glance",
    summary: "See occupancy, revenue, arrivals, and alerts in one place.",
    category: "Overview",
    roles: ["owner", "manager", "frontdesk"],
    tags: ["dashboard", "overview", "metrics"],
    steps: [
      "Open Dashboard to view occupancy, revenue, and arrivals widgets.",
      "Use the date selector to change the time window.",
      "Click a widget to drill into the related report.",
      "Watch alerts on the right for tasks needing action."
    ],
    tips: [
      "Refreshes automatically every few minutes; use reload if data looks stale.",
      "Pin the widgets you use most; they stay in place per user."
    ]
  },
  {
    id: "calendar-availability",
    title: "Calendar & Availability",
    summary: "See site availability and drag to create or edit reservations.",
    category: "Reservations",
    roles: ["frontdesk", "manager"],
    tags: ["calendar", "availability", "reservations"],
    steps: [
      "Open Calendar to view sites by date range.",
      "Hover a site row to see upcoming stays and holds.",
      "Drag across dates to start a new reservation.",
      "Click a booking block to edit dates, guests, or site."
    ],
    tips: [
      "Use filters to show only certain classes or statuses.",
      "Color legend helps quickly spot holds vs confirmed stays."
    ]
  },
  {
    id: "booking-new",
    title: "Create a New Reservation",
    summary: "Start a booking from booking flow or calendar drag.",
    category: "Reservations",
    roles: ["frontdesk", "manager"],
    tags: ["booking", "reservation", "new"],
    steps: [
      "Go to Booking or drag-select dates on the calendar.",
      "Choose arrival/departure and guest count.",
      "Pick an available site; compare price if multiple.",
      "Enter guest contact, vehicles, and notes.",
      "Collect deposit or full payment and confirm."
    ],
    tips: [
      "If a guest exists, search by email/phone to re-use details.",
      "Apply discounts or promo codes before collecting payment."
    ]
  },
  {
    id: "reservation-manage",
    title: "Manage an Existing Reservation",
    summary: "Adjust dates, guests, payments, or site assignments.",
    category: "Reservations",
    roles: ["frontdesk", "manager"],
    tags: ["reservation", "edit", "change", "assign"],
    steps: [
      "Open Reservations and search by name, code, or dates.",
      "Select the reservation to view timeline and balance.",
      "Change dates or site; system checks conflicts automatically.",
      "Add charges or refunds; issue updated confirmation.",
      "Log notes and tasks for staff follow-up."
    ],
    tips: [
      "Reassigning sites keeps history; guests see the latest assignment.",
      "Use hold status if awaiting payment instead of cancelling."
    ]
  },
  {
    id: "check-in-out",
    title: "Check-In and Check-Out",
    summary: "Process arrivals and departures smoothly.",
    category: "Front Desk",
    roles: ["frontdesk", "manager"],
    tags: ["check-in", "check-out", "front desk"],
    steps: [
      "Open Due for Arrival/Departure lists or Reservations.",
      "Confirm identity, party size, and balance.",
      "Collect remaining payments; issue receipts.",
      "Mark status to Checked In or Checked Out.",
      "Notify housekeeping/maintenance if required."
    ],
    tips: [
      "Late check-outs can auto-add a fee per policy.",
      "Add quick notes for issues spotted during checkout."
    ]
  },
  {
    id: "guests-profiles",
    title: "Guest Profiles & History",
    summary: "View guest contact info, stays, charges, and notes.",
    category: "Guests",
    roles: ["frontdesk", "manager"],
    tags: ["guests", "history", "profile"],
    steps: [
      "Open Guests and search by name, email, or phone.",
      "Open a profile to see past and upcoming stays.",
      "Review balance history and saved payment methods.",
      "Add internal notes or flags for special handling.",
      "Send confirmation or statement directly from the profile."
    ],
    tips: [
      "Use flags for VIP, do-not-rent, or special access needs.",
      "Profiles consolidate OTA and direct bookings under matching emails."
    ]
  },
  {
    id: "payments-collect",
    title: "Collect a Payment",
    summary: "Take card, cash, or other payments against a reservation.",
    category: "Payments",
    roles: ["frontdesk", "finance"],
    tags: ["payments", "collection", "pos"],
    steps: [
      "Open the reservation Billing tab.",
      "Click Collect Payment and choose method.",
      "Enter amount (deposit or full) and any notes.",
      "Process the card or record cash/check reference.",
      "Issue receipt via email or print."
    ],
    tips: [
      "Partial payments keep remaining balance visible to staff.",
      "Always add a note for checks (number and bank)."
    ]
  },
  {
    id: "payments-refund",
    title: "Issue a Refund",
    summary: "Process full or partial refunds with audit notes.",
    category: "Payments",
    roles: ["manager", "finance"],
    tags: ["refunds", "payments", "finance"],
    steps: [
      "Open the reservation Billing tab.",
      "Select Refund and choose the original payment.",
      "Enter refund amount and reason.",
      "Confirm; system records audit trail and updates balance.",
      "Send updated receipt to the guest."
    ],
    tips: [
      "Refunds follow your gateway rules; some card fees are non-refundable.",
      "Use notes to capture approval reference."
    ]
  },
  {
    id: "ledger-close-day",
    title: "Daily Close & Ledger",
    summary: "Reconcile payments, refunds, and deposits each day.",
    category: "Finance",
    roles: ["finance", "manager"],
    tags: ["ledger", "close", "reconciliation"],
    steps: [
      "Open Ledger and filter by today's date.",
      "Confirm totals by payment type match your terminals.",
      "Resolve pending or failed payments before closing.",
      "Export the ledger CSV/PDF for accounting.",
      "Lock the day to prevent accidental changes."
    ],
    tips: [
      "Locking creates an audit trail; unlock only with manager approval.",
      "Use repeat charges to schedule recurring invoices."
    ]
  },
  {
    id: "reports-overview",
    title: "Reports & Exports",
    summary: "Access occupancy, revenue, and activity reports.",
    category: "Reports",
    roles: ["owner", "manager", "finance"],
    tags: ["reports", "export", "analytics"],
    steps: [
      "Open Reports and pick a tab: Revenue, Operations, Guests, Audit.",
      "Set date range, campground, and site filters.",
      "Drill into rows to see underlying reservations.",
      "Save a report view for quick reuse.",
      "Export CSV or PDF for sharing."
    ],
    tips: [
      "Use saved reports for weekly digests to stakeholders.",
      "Audit tab lists every change with who/when."
    ]
  },
  {
    id: "pricing-rules",
    title: "Pricing Rules & Overrides",
    summary: "Manage base rates, seasonal adjustments, and discounts.",
    category: "Pricing",
    roles: ["owner", "manager"],
    tags: ["pricing", "rates", "seasons"],
    steps: [
      "Open Pricing to see current rate cards.",
      "Add rules for flat or percent adjustments.",
      "Use seasonal windows for peak/off-peak ranges.",
      "Set minimum nights or day-of-week rules.",
      "Preview final nightly price before saving."
    ],
    tips: [
      "Stack rules carefully; the preview shows combined effects.",
      "Use site classes to update groups of sites at once."
    ]
  },
  {
    id: "site-classes",
    title: "Manage Site Classes",
    summary: "Group sites by hookups, size, or amenities.",
    category: "Inventory",
    roles: ["manager"],
    tags: ["sites", "classes", "inventory"],
    steps: [
      "Open Campgrounds → Classes.",
      "Create a class with name, description, and amenities.",
      "Assign sites to the class for shared pricing rules.",
      "Set active/inactive to control availability.",
      "Save and verify rates inherited in Pricing."
    ],
    tips: [
      "Inactive classes keep history but hide from booking.",
      "Use clear names (e.g., FHU 50A Pull-Through)."
    ]
  },
  {
    id: "sites-management",
    title: "Manage Sites & Amenities",
    summary: "Add, edit, and retire individual sites.",
    category: "Inventory",
    roles: ["manager"],
    tags: ["sites", "inventory", "amenities"],
    steps: [
      "Open Campgrounds → Sites.",
      "Add site number/name, hookups, max length, and notes.",
      "Assign to a class for pricing inheritance.",
      "Set status (active, offline, maintenance).",
      "Save and verify it appears in availability."
    ],
    tips: [
      "Mark offline for temporary issues; history remains intact.",
      "Include rig length and pad type to reduce booking errors."
    ]
  },
  {
    id: "campground-setup",
    title: "Campground Setup",
    summary: "Configure basic details, contact info, and policies.",
    category: "Settings",
    roles: ["owner", "manager"],
    tags: ["setup", "settings", "campground"],
    steps: [
      "Open Campgrounds and choose your property.",
      "Edit name, address, time zone, and contact details.",
      "Set default check-in/out times and quiet hours.",
      "Upload branding (logo/colors) if available.",
      "Save and review that details show on guest docs."
    ],
    tips: [
      "Keep support phone/email current for guest communications.",
      "Time zone drives arrivals/departures—verify correctness."
    ]
  },
  {
    id: "maintenance-work-orders",
    title: "Maintenance & Work Orders",
    summary: "Track issues, assign owners, and monitor progress.",
    category: "Operations",
    roles: ["maintenance", "manager"],
    tags: ["maintenance", "work orders", "operations"],
    steps: [
      "Open Maintenance and create a new work order.",
      "Select site (optional) and describe the issue.",
      "Set priority and due date; assign to a teammate.",
      "Update status as work progresses; add photos if needed.",
      "Close the task and notify front desk if guest impacted."
    ],
    tips: [
      "Use priorities to triage: safety first, guest-impact second.",
      "Due dates help housekeeping and front desk plan around closures."
    ]
  },
  {
    id: "blackout-dates",
    title: "Blackout Dates & Holds",
    summary: "Prevent bookings during closures or events.",
    category: "Operations",
    roles: ["manager"],
    tags: ["blackout", "availability", "closures"],
    steps: [
      "Open Settings → Blackout Dates.",
      "Choose campground and optional site(s).",
      "Set start/end dates and reason.",
      "Save; blackouts immediately block availability.",
      "Remove or edit to reopen dates."
    ],
    tips: [
      "Use reasons like weather, maintenance, or private event.",
      "For partial blocks (specific hours), add a note for staff."
    ]
  },
  {
    id: "messages-inbox",
    title: "Messages & Guest Replies",
    summary: "Respond to guest SMS/email from a single inbox.",
    category: "Communication",
    roles: ["frontdesk", "manager"],
    tags: ["messages", "sms", "email"],
    steps: [
      "Open Messages to see all threads per campground.",
      "Filter by unread to prioritize responses.",
      "Send replies; templates speed up common answers.",
      "Attach reservation links for quick actions.",
      "Mark resolved when done; unread counts will clear."
    ],
    tips: [
      "Use templates for WiFi info, directions, and policies.",
      "System auto-links messages to reservations when possible."
    ]
  },
  {
    id: "ota-channels",
    title: "OTA & Channel Management",
    summary: "Sync availability and rates with OTAs (Airbnb, Hipcamp, etc.).",
    category: "Distribution",
    roles: ["owner", "manager"],
    tags: ["ota", "channels", "distribution"],
    steps: [
      "Open Settings → OTA Channels.",
      "Connect a channel and authorize access.",
      "Map site classes to OTA room types.",
      "Set rate adjustments or fees per channel.",
      "Sync and verify test availability from the OTA side."
    ],
    tips: [
      "Keep calendars aligned—enable two-way sync where supported.",
      "Use channel-specific fees to offset commissions."
    ]
  },
  {
    id: "payments-config",
    title: "Payments & Deposits Configuration",
    summary: "Control gateways, deposits, and auto-capture rules.",
    category: "Settings",
    roles: ["owner", "finance"],
    tags: ["payments", "settings", "deposits"],
    steps: [
      "Open Settings → Payments.",
      "Connect your payment gateway and test a $1 auth.",
      "Set default deposit rule (flat or percent).",
      "Choose auto-capture timing or manual capture.",
      "Save; new bookings follow the updated policy."
    ],
    tips: [
      "Use lower deposits for long lead times; higher for peak dates.",
      "Manual capture helps for high-risk bookings; monitor reminders."
    ]
  },
  {
    id: "users-roles",
    title: "Users & Roles",
    summary: "Invite staff and assign permissions.",
    category: "Settings",
    roles: ["owner", "manager"],
    tags: ["users", "roles", "access"],
    steps: [
      "Open Settings → Users & Roles.",
      "Invite a user by email and choose a role.",
      "Adjust role permissions if needed.",
      "Assign campground access where applicable.",
      "Deactivate users who no longer need access."
    ],
    tips: [
      "Use least-privilege: limit finance access to trusted staff.",
      "Reassign conversations and tasks before deactivation."
    ]
  },
  {
    id: "policies-rules",
    title: "Policies & House Rules",
    summary: "Publish cancellation, pets, and quiet-hours policies.",
    category: "Settings",
    roles: ["manager", "owner"],
    tags: ["policies", "rules", "settings"],
    steps: [
      "Open Settings → Policies.",
      "Enter cancellation windows and fees.",
      "Add pets, quiet hours, and vehicle rules.",
      "Save; policies appear on confirmations and guest portal.",
      "Version changes are logged for audit."
    ],
    tips: [
      "Keep language short and guest-friendly.",
      "Update seasonal cancellation windows before peak periods."
    ]
  },
  {
    id: "repeat-charges",
    title: "Repeat Charges & Subscriptions",
    summary: "Automate recurring invoices for long stays or storage.",
    category: "Finance",
    roles: ["finance", "manager"],
    tags: ["billing", "repeat charges", "subscriptions"],
    steps: [
      "Open Billing → Repeat Charges.",
      "Create a schedule (weekly/monthly) and amount.",
      "Attach to a reservation or account.",
      "Set auto-collect or manual review.",
      "Monitor upcoming charges in the schedule list."
    ],
    tips: [
      "Use start/end dates to avoid surprise charges.",
      "Include tax settings per product/service."
    ]
  },
  {
    id: "maintenance-cleaning",
    title: "Housekeeping & Turnover",
    summary: "Coordinate cleaning after check-out and maintenance holds.",
    category: "Operations",
    roles: ["maintenance", "frontdesk"],
    tags: ["housekeeping", "turnover", "operations"],
    steps: [
      "Open Maintenance or the In-House list for today's departures.",
      "Mark sites as Needs Cleaning during checkout.",
      "Assign cleaning tasks and due times.",
      "Update status to Ready when complete.",
      "Front desk can now reassign or release the site."
    ],
    tips: [
      "Use comments for items left behind; coordinate with front desk.",
      "Track turnaround times to improve staffing estimates."
    ]
  },
  {
    id: "marketing-promotions",
    title: "Promotions & Discounts",
    summary: "Create promo codes and targeted offers.",
    category: "Marketing",
    roles: ["marketing", "manager"],
    tags: ["promotions", "discounts", "marketing"],
    steps: [
      "Open Marketing → Promotions.",
      "Create a code with date range and usage limits.",
      "Choose eligible site classes and channels.",
      "Set discount type (flat or percent).",
      "Publish and share the code with guests."
    ],
    tips: [
      "Use channel-specific codes to measure performance.",
      "Limit redemptions to avoid over-discounting peak dates."
    ]
  },
  {
    id: "forms-waivers",
    title: "Forms & Waivers",
    summary: "Collect guest waivers and custom intake info.",
    category: "Operations",
    roles: ["manager", "frontdesk"],
    tags: ["forms", "waivers", "intake"],
    steps: [
      "Open Forms & Docs.",
      "Choose a template or create a new form.",
      "Attach form to reservation types or site classes.",
      "Send to guest via email/SMS or collect at check-in.",
      "Track completion status from the reservation."
    ],
    tips: [
      "Make required fields concise to speed check-in.",
      "Store signed PDFs with the reservation record."
    ]
  },
  {
    id: "branding",
    title: "Branding Basics",
    summary: "Add logos and colors for receipts and guest emails.",
    category: "Settings",
    roles: ["manager", "marketing"],
    tags: ["branding", "appearance", "settings"],
    steps: [
      "Open Settings → Branding.",
      "Upload logo and select brand colors.",
      "Preview receipts and emails with branding applied.",
      "Save to publish across guest-facing touchpoints.",
      "Update seasonally if branding changes."
    ],
    tips: [
      "Use high-res logos with transparent backgrounds.",
      "Ensure color contrast for accessibility."
    ]
  },
  {
    id: "support-contact",
    title: "Contact Support",
    summary: "Reach the support team when you need help.",
    category: "Support",
    tags: ["support", "contact"],
    steps: [
      "Check this help panel for answers first.",
      "Use in-app chat or email support@keeprstay.com.",
      "Include reservation IDs or screenshots for faster help.",
      "For outages, provide error messages and time of issue."
    ],
    tips: [
      "Describe the path you took to reach the issue.",
      "If payments fail, include gateway reference IDs."
    ],
    links: [{ label: "Open support form", href: "/dashboard/help/contact" }]
  }
];
