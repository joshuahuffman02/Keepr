/**
 * Webhook Event Catalog
 *
 * This module documents all webhook event types with their JSON schemas and payload examples.
 * Use this as the single source of truth for webhook event definitions.
 */

/**
 * All supported webhook event types
 */
export type WebhookEvent =
  // Reservations
  | "reservation.created"
  | "reservation.updated"
  | "reservation.cancelled"
  | "reservation.deleted"
  | "reservation.checked_in"
  | "reservation.checked_out"
  // Payments
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "payment.created"
  // Guests
  | "guest.created"
  | "guest.updated"
  | "guest.deleted"
  // Check-in/out events
  | "checkin.completed"
  | "checkout.completed"
  // Sites
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "site.blocked"
  | "site.unblocked"
  // Events/Activities
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "event.registration"
  // Charity
  | "charity.donation"
  | "charity.payout"
  // Store/POS
  | "order.created"
  | "order.refunded"
  // Messaging
  | "message.received"
  | "message.sent"
  // Inventory (3rd Party POS Integration)
  | "inventory.expiration.warning"
  | "inventory.expiration.critical"
  | "inventory.expiration.expired"
  | "inventory.batch.received"
  | "inventory.batch.depleted"
  | "inventory.low_stock"
  | "markdown.rule.applied"
  | "product.price.changed";

/**
 * Event category groupings
 */
export type EventCategory =
  | "Reservations"
  | "Payments"
  | "Guests"
  | "Check-in/out"
  | "Sites"
  | "Events"
  | "Charity"
  | "Store"
  | "Messaging"
  | "Inventory";

/**
 * JSON Schema for a single field
 */
export interface FieldSchema {
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  description: string;
  format?: string;
  enum?: string[];
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  nullable?: boolean;
}

/**
 * Event definition with schema and examples
 */
export interface EventDefinition {
  event: WebhookEvent;
  category: EventCategory;
  description: string;
  schema: {
    type: "object";
    properties: Record<string, FieldSchema>;
    required: string[];
  };
  example: Record<string, unknown>;
}

/**
 * Common field schemas reused across events
 */
const CommonFields: Record<string, FieldSchema> = {
  id: {
    type: "string",
    description: "Unique identifier (CUID)",
    format: "cuid",
  },
  campgroundId: {
    type: "string",
    description: "Campground identifier",
    format: "cuid",
  },
  timestamp: {
    type: "string",
    description: "ISO 8601 timestamp",
    format: "date-time",
  },
  dateOnly: {
    type: "string",
    description: "Date in YYYY-MM-DD format",
    format: "date",
  },
  email: {
    type: "string",
    description: "Email address",
    format: "email",
  },
  phone: {
    type: "string",
    description: "Phone number",
    format: "phone",
  },
  moneyAmount: {
    type: "number",
    description: "Amount in cents (integer)",
    format: "int32",
  },
};

/**
 * Complete event catalog with schemas and examples
 */
export const EventCatalog: EventDefinition[] = [
  // ============================================
  // RESERVATION EVENTS
  // ============================================
  {
    event: "reservation.created",
    category: "Reservations",
    description: "Fired when a new reservation is created",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        confirmationNumber: {
          type: "string",
          description: "Human-readable confirmation number",
        },
        guestId: CommonFields.id,
        siteId: CommonFields.id,
        siteName: { type: "string", description: "Name of the reserved site" },
        siteClassId: CommonFields.id,
        siteClassName: {
          type: "string",
          description: "Name of the site class (e.g., RV, Tent)",
        },
        checkIn: CommonFields.dateOnly,
        checkOut: CommonFields.dateOnly,
        nights: { type: "number", description: "Number of nights" },
        status: {
          type: "string",
          description: "Reservation status",
          enum: ["pending", "confirmed", "checked_in", "checked_out", "cancelled"],
        },
        totalCents: CommonFields.moneyAmount,
        paidCents: CommonFields.moneyAmount,
        balanceCents: CommonFields.moneyAmount,
        adults: { type: "number", description: "Number of adults" },
        children: { type: "number", description: "Number of children" },
        pets: { type: "number", description: "Number of pets" },
        vehicles: { type: "number", description: "Number of vehicles" },
        source: {
          type: "string",
          description: "Booking source",
          enum: ["direct", "phone", "walk_in", "ota", "api"],
        },
        notes: { type: "string", description: "Internal notes", nullable: true },
        guest: {
          type: "object",
          description: "Guest details",
          properties: {
            id: CommonFields.id,
            firstName: { type: "string", description: "First name" },
            lastName: { type: "string", description: "Last name" },
            email: CommonFields.email,
            phone: CommonFields.phone,
          },
          required: ["id", "firstName", "lastName"],
        },
        createdAt: CommonFields.timestamp,
      },
      required: [
        "id",
        "campgroundId",
        "confirmationNumber",
        "guestId",
        "siteId",
        "checkIn",
        "checkOut",
        "status",
        "totalCents",
        "createdAt",
      ],
    },
    example: {
      id: "clx1abc2d0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      confirmationNumber: "RES-2024-001234",
      guestId: "clx1abc2d0003abcdefghijk",
      siteId: "clx1abc2d0004abcdefghijk",
      siteName: "Site 42",
      siteClassId: "clx1abc2d0005abcdefghijk",
      siteClassName: "Premium RV",
      checkIn: "2024-07-15",
      checkOut: "2024-07-20",
      nights: 5,
      status: "confirmed",
      totalCents: 37500,
      paidCents: 18750,
      balanceCents: 18750,
      adults: 2,
      children: 1,
      pets: 1,
      vehicles: 1,
      source: "direct",
      notes: null,
      guest: {
        id: "clx1abc2d0003abcdefghijk",
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
        phone: "+1-555-123-4567",
      },
      createdAt: "2024-06-01T10:30:00.000Z",
    },
  },
  {
    event: "reservation.updated",
    category: "Reservations",
    description: "Fired when a reservation is modified",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        confirmationNumber: {
          type: "string",
          description: "Human-readable confirmation number",
        },
        changes: {
          type: "object",
          description: "Fields that were changed",
          properties: {},
        },
        previous: {
          type: "object",
          description: "Previous values of changed fields",
          properties: {},
        },
        current: {
          type: "object",
          description: "Current reservation data",
          properties: {},
        },
        updatedAt: CommonFields.timestamp,
        updatedBy: {
          type: "string",
          description: "User ID who made the change",
          nullable: true,
        },
      },
      required: ["id", "campgroundId", "changes", "current", "updatedAt"],
    },
    example: {
      id: "clx1abc2d0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      confirmationNumber: "RES-2024-001234",
      changes: ["checkOut", "nights", "totalCents"],
      previous: {
        checkOut: "2024-07-20",
        nights: 5,
        totalCents: 37500,
      },
      current: {
        checkOut: "2024-07-22",
        nights: 7,
        totalCents: 52500,
      },
      updatedAt: "2024-06-15T14:22:00.000Z",
      updatedBy: "clx1user0001abcdefghijk",
    },
  },
  {
    event: "reservation.cancelled",
    category: "Reservations",
    description: "Fired when a reservation is cancelled",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        confirmationNumber: {
          type: "string",
          description: "Human-readable confirmation number",
        },
        guestId: CommonFields.id,
        checkIn: CommonFields.dateOnly,
        checkOut: CommonFields.dateOnly,
        cancellationReason: {
          type: "string",
          description: "Reason for cancellation",
          nullable: true,
        },
        refundCents: CommonFields.moneyAmount,
        penaltyCents: CommonFields.moneyAmount,
        cancelledAt: CommonFields.timestamp,
        cancelledBy: {
          type: "string",
          description: "User ID who cancelled",
          nullable: true,
        },
      },
      required: ["id", "campgroundId", "confirmationNumber", "cancelledAt"],
    },
    example: {
      id: "clx1abc2d0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      confirmationNumber: "RES-2024-001234",
      guestId: "clx1abc2d0003abcdefghijk",
      checkIn: "2024-07-15",
      checkOut: "2024-07-20",
      cancellationReason: "Change of plans",
      refundCents: 15000,
      penaltyCents: 3750,
      cancelledAt: "2024-06-10T09:15:00.000Z",
      cancelledBy: "clx1user0001abcdefghijk",
    },
  },
  // ============================================
  // PAYMENT EVENTS
  // ============================================
  {
    event: "payment.succeeded",
    category: "Payments",
    description: "Fired when a payment is successfully processed",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        reservationId: {
          ...CommonFields.id,
          nullable: true,
          description: "Associated reservation ID (if any)",
        },
        guestId: CommonFields.id,
        amountCents: CommonFields.moneyAmount,
        currency: { type: "string", description: "3-letter currency code" },
        method: {
          type: "string",
          description: "Payment method",
          enum: ["card", "cash", "check", "ach", "gift_card", "wallet"],
        },
        last4: {
          type: "string",
          description: "Last 4 digits of card (if applicable)",
          nullable: true,
        },
        brand: {
          type: "string",
          description: "Card brand (if applicable)",
          nullable: true,
        },
        stripePaymentIntentId: {
          type: "string",
          description: "Stripe Payment Intent ID",
          nullable: true,
        },
        receiptUrl: {
          type: "string",
          description: "URL to payment receipt",
          nullable: true,
        },
        processedAt: CommonFields.timestamp,
      },
      required: [
        "id",
        "campgroundId",
        "guestId",
        "amountCents",
        "currency",
        "method",
        "processedAt",
      ],
    },
    example: {
      id: "clx1pay0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      reservationId: "clx1abc2d0001abcdefghijk",
      guestId: "clx1abc2d0003abcdefghijk",
      amountCents: 18750,
      currency: "USD",
      method: "card",
      last4: "4242",
      brand: "visa",
      stripePaymentIntentId: "pi_1234567890abcdef",
      receiptUrl: "https://pay.stripe.com/receipts/...",
      processedAt: "2024-06-01T10:32:00.000Z",
    },
  },
  {
    event: "payment.failed",
    category: "Payments",
    description: "Fired when a payment attempt fails",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        reservationId: { ...CommonFields.id, nullable: true },
        guestId: CommonFields.id,
        amountCents: CommonFields.moneyAmount,
        currency: { type: "string", description: "3-letter currency code" },
        method: {
          type: "string",
          description: "Payment method",
          enum: ["card", "cash", "check", "ach", "gift_card", "wallet"],
        },
        failureCode: {
          type: "string",
          description: "Failure code from payment processor",
        },
        failureMessage: {
          type: "string",
          description: "Human-readable failure message",
        },
        declineCode: {
          type: "string",
          description: "Decline code (if card declined)",
          nullable: true,
        },
        failedAt: CommonFields.timestamp,
      },
      required: [
        "id",
        "campgroundId",
        "guestId",
        "amountCents",
        "failureCode",
        "failureMessage",
        "failedAt",
      ],
    },
    example: {
      id: "clx1pay0002abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      reservationId: "clx1abc2d0001abcdefghijk",
      guestId: "clx1abc2d0003abcdefghijk",
      amountCents: 18750,
      currency: "USD",
      method: "card",
      failureCode: "card_declined",
      failureMessage: "Your card was declined.",
      declineCode: "insufficient_funds",
      failedAt: "2024-06-01T10:32:00.000Z",
    },
  },
  {
    event: "payment.refunded",
    category: "Payments",
    description: "Fired when a payment is refunded (full or partial)",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        originalPaymentId: CommonFields.id,
        reservationId: { ...CommonFields.id, nullable: true },
        guestId: CommonFields.id,
        amountCents: CommonFields.moneyAmount,
        reason: {
          type: "string",
          description: "Reason for refund",
          nullable: true,
        },
        isFullRefund: {
          type: "boolean",
          description: "Whether this is a full refund",
        },
        stripeRefundId: {
          type: "string",
          description: "Stripe Refund ID",
          nullable: true,
        },
        refundedAt: CommonFields.timestamp,
        refundedBy: {
          type: "string",
          description: "User ID who processed refund",
          nullable: true,
        },
      },
      required: [
        "id",
        "campgroundId",
        "originalPaymentId",
        "guestId",
        "amountCents",
        "isFullRefund",
        "refundedAt",
      ],
    },
    example: {
      id: "clx1ref0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      originalPaymentId: "clx1pay0001abcdefghijk",
      reservationId: "clx1abc2d0001abcdefghijk",
      guestId: "clx1abc2d0003abcdefghijk",
      amountCents: 5000,
      reason: "Early checkout",
      isFullRefund: false,
      stripeRefundId: "re_1234567890abcdef",
      refundedAt: "2024-06-20T11:00:00.000Z",
      refundedBy: "clx1user0001abcdefghijk",
    },
  },
  // ============================================
  // GUEST EVENTS
  // ============================================
  {
    event: "guest.created",
    category: "Guests",
    description: "Fired when a new guest profile is created",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        email: { ...CommonFields.email, nullable: true },
        phone: { ...CommonFields.phone, nullable: true },
        address: {
          type: "object",
          description: "Mailing address",
          nullable: true,
          properties: {
            street: { type: "string", description: "Street address" },
            city: { type: "string", description: "City" },
            state: { type: "string", description: "State/Province" },
            postalCode: { type: "string", description: "Postal/ZIP code" },
            country: { type: "string", description: "Country code" },
          },
        },
        tags: {
          type: "array",
          description: "Guest tags/labels",
          items: { type: "string", description: "Tag name" },
        },
        source: {
          type: "string",
          description: "How guest was acquired",
          enum: ["direct", "ota", "referral", "walk_in", "import"],
        },
        createdAt: CommonFields.timestamp,
      },
      required: ["id", "campgroundId", "firstName", "lastName", "createdAt"],
    },
    example: {
      id: "clx1abc2d0003abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@example.com",
      phone: "+1-555-123-4567",
      address: {
        street: "123 Main St",
        city: "Denver",
        state: "CO",
        postalCode: "80202",
        country: "US",
      },
      tags: ["VIP", "returning"],
      source: "direct",
      createdAt: "2024-06-01T10:28:00.000Z",
    },
  },
  {
    event: "guest.updated",
    category: "Guests",
    description: "Fired when a guest profile is updated",
    schema: {
      type: "object",
      properties: {
        id: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        changes: {
          type: "array",
          description: "List of changed field names",
          items: { type: "string", description: "Field name" },
        },
        previous: {
          type: "object",
          description: "Previous values",
          properties: {},
        },
        current: {
          type: "object",
          description: "Current values",
          properties: {},
        },
        updatedAt: CommonFields.timestamp,
      },
      required: ["id", "campgroundId", "changes", "current", "updatedAt"],
    },
    example: {
      id: "clx1abc2d0003abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      changes: ["phone", "tags"],
      previous: {
        phone: "+1-555-123-4567",
        tags: ["VIP"],
      },
      current: {
        phone: "+1-555-987-6543",
        tags: ["VIP", "returning", "long_term"],
      },
      updatedAt: "2024-06-15T16:45:00.000Z",
    },
  },
  // ============================================
  // CHECK-IN/OUT EVENTS
  // ============================================
  {
    event: "checkin.completed",
    category: "Check-in/out",
    description: "Fired when a guest completes check-in",
    schema: {
      type: "object",
      properties: {
        reservationId: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        confirmationNumber: { type: "string", description: "Confirmation number" },
        guestId: CommonFields.id,
        guestName: { type: "string", description: "Full guest name" },
        siteId: CommonFields.id,
        siteName: { type: "string", description: "Site name" },
        checkedInAt: CommonFields.timestamp,
        checkedInBy: {
          type: "string",
          description: "Staff user ID who checked in guest",
          nullable: true,
        },
        isSelfCheckIn: {
          type: "boolean",
          description: "Whether guest used self check-in",
        },
      },
      required: ["reservationId", "campgroundId", "guestId", "siteId", "checkedInAt"],
    },
    example: {
      reservationId: "clx1abc2d0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      confirmationNumber: "RES-2024-001234",
      guestId: "clx1abc2d0003abcdefghijk",
      guestName: "John Smith",
      siteId: "clx1abc2d0004abcdefghijk",
      siteName: "Site 42",
      checkedInAt: "2024-07-15T14:30:00.000Z",
      checkedInBy: "clx1user0002abcdefghijk",
      isSelfCheckIn: false,
    },
  },
  {
    event: "checkout.completed",
    category: "Check-in/out",
    description: "Fired when a guest completes check-out",
    schema: {
      type: "object",
      properties: {
        reservationId: CommonFields.id,
        campgroundId: CommonFields.campgroundId,
        confirmationNumber: { type: "string", description: "Confirmation number" },
        guestId: CommonFields.id,
        guestName: { type: "string", description: "Full guest name" },
        siteId: CommonFields.id,
        siteName: { type: "string", description: "Site name" },
        checkedOutAt: CommonFields.timestamp,
        checkedOutBy: {
          type: "string",
          description: "Staff user ID",
          nullable: true,
        },
        finalBalanceCents: CommonFields.moneyAmount,
        additionalChargesCents: CommonFields.moneyAmount,
      },
      required: [
        "reservationId",
        "campgroundId",
        "guestId",
        "siteId",
        "checkedOutAt",
        "finalBalanceCents",
      ],
    },
    example: {
      reservationId: "clx1abc2d0001abcdefghijk",
      campgroundId: "clx1abc2d0002abcdefghijk",
      confirmationNumber: "RES-2024-001234",
      guestId: "clx1abc2d0003abcdefghijk",
      guestName: "John Smith",
      siteId: "clx1abc2d0004abcdefghijk",
      siteName: "Site 42",
      checkedOutAt: "2024-07-20T11:00:00.000Z",
      checkedOutBy: null,
      finalBalanceCents: 0,
      additionalChargesCents: 2500,
    },
  },
];

/**
 * Get all event types grouped by category
 */
export function getEventsByCategory(): Record<EventCategory, EventDefinition[]> {
  const grouped: Record<EventCategory, EventDefinition[]> = {
    Reservations: [],
    Payments: [],
    Guests: [],
    "Check-in/out": [],
    Sites: [],
    Events: [],
    Charity: [],
    Store: [],
    Messaging: [],
    Inventory: [],
  };

  for (const event of EventCatalog) {
    grouped[event.category].push(event);
  }

  return grouped;
}

/**
 * Get all available event types
 */
export function getAllEventTypes(): string[] {
  return EventCatalog.map((e) => e.event);
}

/**
 * Get all categories
 */
export function getAllCategories(): EventCategory[] {
  return [...new Set(EventCatalog.map((e) => e.category))];
}

/**
 * Get event definition by type
 */
export function getEventDefinition(eventType: WebhookEvent): EventDefinition | undefined {
  return EventCatalog.find((e) => e.event === eventType);
}

/**
 * Get example payload for an event type
 */
export function getEventExample(eventType: WebhookEvent): Record<string, unknown> | undefined {
  return EventCatalog.find((e) => e.event === eventType)?.example;
}

/**
 * Check if an event type matches a pattern (supports wildcards)
 */
export function matchesEventPattern(eventType: WebhookEvent, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern === eventType) return true;

  // Handle category wildcards (e.g., "reservation.*")
  if (pattern.endsWith(".*")) {
    const category = pattern.slice(0, -2);
    return eventType.startsWith(`${category}.`);
  }

  return false;
}

/**
 * Validate that event types in a subscription are valid
 */
export function validateEventTypes(eventTypes: string[]): { valid: boolean; invalid: string[] } {
  const allEvents = getAllEventTypes();
  const invalid: string[] = [];

  for (const et of eventTypes) {
    if (et === "*") continue;
    if (et.endsWith(".*")) {
      // Category wildcard - check if category exists
      const category = et.slice(0, -2);
      const hasCategory = allEvents.some((e) => e.startsWith(`${category}.`));
      if (!hasCategory) {
        invalid.push(et);
      }
      continue;
    }
    if (!allEvents.includes(et)) {
      invalid.push(et);
    }
  }

  return { valid: invalid.length === 0, invalid };
}

/**
 * Event catalog summary for documentation
 */
export const EventCatalogSummary = EventCatalog.map((e) => ({
  event: e.event,
  category: e.category,
  description: e.description,
}));
