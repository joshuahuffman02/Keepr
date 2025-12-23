import { ReportDimensionSpec, ReportFilterSpec, ReportMetricSpec, ReportSpec, ReportSource } from "./report.types";

type SourceLibrary = {
  dimensions: Record<string, ReportDimensionSpec>;
  metrics: Record<string, ReportMetricSpec>;
  filters: ReportFilterSpec[];
};

// Shared date helpers
const dateDims: Record<string, ReportDimensionSpec> = {
  booked_day: { id: "booked_day", label: "Booked Day", field: "createdAt", kind: "date", timeGrain: "day" },
  booked_week: { id: "booked_week", label: "Booked Week", field: "createdAt", kind: "date", timeGrain: "week" },
  booked_month: { id: "booked_month", label: "Booked Month", field: "createdAt", kind: "date", timeGrain: "month" },
  arrival_day: { id: "arrival_day", label: "Arrival Day", field: "arrivalDate", kind: "date", timeGrain: "day" },
  arrival_month: { id: "arrival_month", label: "Arrival Month", field: "arrivalDate", kind: "date", timeGrain: "month" },
};

const reservationLibrary: SourceLibrary = {
  dimensions: {
    ...dateDims,
    status: { id: "status", label: "Status", field: "status", kind: "enum" },
    source: { id: "source", label: "Source", field: "source", kind: "enum", fallback: "unknown" },
    stay_type: { id: "stay_type", label: "Stay Type", field: "stayType", kind: "enum" },
    rig_type: { id: "rig_type", label: "Rig Type", field: "rigType", kind: "enum", fallback: "unspecified" },
    promo_code: { id: "promo_code", label: "Promo Code", field: "promoCode", kind: "string", fallback: "none" },
    lead_time_bucket: { id: "lead_time_bucket", label: "Lead Time Bucket", field: "leadTimeDays", kind: "number" },
    length_of_stay: { id: "length_of_stay", label: "Length of Stay", field: "nights", kind: "number" },
  },
  metrics: {
    bookings: { id: "bookings", label: "Bookings", field: "id", aggregation: "count", type: "number" },
    revenue: { id: "revenue", label: "Gross Revenue", field: "totalAmount", aggregation: "sum", type: "currency", format: "currency" },
    paid: { id: "paid", label: "Paid Amount", field: "paidAmount", aggregation: "sum", type: "currency", format: "currency" },
    balance: { id: "balance", label: "Outstanding Balance", field: "balanceAmount", aggregation: "sum", type: "currency", format: "currency" },
    adr: { id: "adr", label: "ADR", field: "totalAmount", aggregation: "avg", type: "currency", format: "currency" },
    lead_time_avg: { id: "lead_time_avg", label: "Avg Lead Time (days)", field: "leadTimeDays", aggregation: "avg", type: "number" },
  },
  filters: [
    { id: "status", label: "Status", field: "status", type: "enum", operators: ["eq", "in"], options: ["pending", "confirmed", "cancelled", "checked_in", "checked_out"] },
    { id: "source", label: "Source", field: "source", type: "enum", operators: ["eq", "in"] },
    { id: "stay_type", label: "Stay Type", field: "stayType", type: "enum", operators: ["eq", "in"], options: ["standard", "group", "long_term"] },
  ],
};

const paymentLibrary: SourceLibrary = {
  dimensions: {
    paid_day: { id: "paid_day", label: "Paid Day", field: "createdAt", kind: "date", timeGrain: "day" },
    paid_week: { id: "paid_week", label: "Paid Week", field: "createdAt", kind: "date", timeGrain: "week" },
    paid_month: { id: "paid_month", label: "Paid Month", field: "createdAt", kind: "date", timeGrain: "month" },
    method: { id: "method", label: "Payment Method", field: "method", kind: "enum" },
    direction: { id: "direction", label: "Direction", field: "direction", kind: "enum" },
  },
  metrics: {
    payments: { id: "payments", label: "Payments", field: "id", aggregation: "count", type: "number" },
    amount: { id: "amount", label: "Amount", field: "amountCents", aggregation: "sum", type: "currency", format: "currency" },
    fees: { id: "fees", label: "Platform Fees", field: "stripeFeeCents", aggregation: "sum", type: "currency", format: "currency" },
  },
  filters: [
    { id: "method", label: "Method", field: "method", type: "string", operators: ["eq", "in"] },
    { id: "direction", label: "Direction", field: "direction", type: "enum", operators: ["eq", "in"], options: ["charge", "refund"] },
  ],
};

const ledgerLibrary: SourceLibrary = {
  dimensions: {
    ledger_day: { id: "ledger_day", label: "Entry Day", field: "occurredAt", kind: "date", timeGrain: "day" },
    ledger_month: { id: "ledger_month", label: "Entry Month", field: "occurredAt", kind: "date", timeGrain: "month" },
    gl_code: { id: "gl_code", label: "GL Code", field: "glCode", kind: "string", fallback: "unassigned" },
    direction: { id: "direction", label: "Direction", field: "direction", kind: "enum" },
  },
  metrics: {
    ledger_amount: { id: "ledger_amount", label: "Ledger Amount", field: "amountCents", aggregation: "sum", type: "currency", format: "currency" },
    ledger_entries: { id: "ledger_entries", label: "Entries", field: "id", aggregation: "count", type: "number" },
  },
  filters: [
    { id: "gl_code", label: "GL Code", field: "glCode", type: "string", operators: ["eq", "in"] },
    { id: "direction", label: "Direction", field: "direction", type: "enum", operators: ["eq", "in"], options: ["debit", "credit"] },
  ],
};

const payoutLibrary: SourceLibrary = {
  dimensions: {
    payout_day: { id: "payout_day", label: "Payout Day", field: "arrivalDate", kind: "date", timeGrain: "day" },
    payout_month: { id: "payout_month", label: "Payout Month", field: "arrivalDate", kind: "date", timeGrain: "month" },
    status: { id: "status", label: "Status", field: "status", kind: "enum" },
    currency: { id: "currency", label: "Currency", field: "currency", kind: "enum" },
  },
  metrics: {
    payout_amount: { id: "payout_amount", label: "Payout Amount", field: "amountCents", aggregation: "sum", type: "currency", format: "currency" },
    payout_fee: { id: "payout_fee", label: "Payout Fees", field: "feeCents", aggregation: "sum", type: "currency", format: "currency" },
  },
  filters: [
    { id: "status", label: "Status", field: "status", type: "enum", operators: ["eq", "in"], options: ["pending", "in_transit", "paid", "failed", "canceled"] },
    { id: "currency", label: "Currency", field: "currency", type: "string", operators: ["eq", "in"] },
  ],
};

const supportLibrary: SourceLibrary = {
  dimensions: {
    support_day: { id: "support_day", label: "Created Day", field: "createdAt", kind: "date", timeGrain: "day" },
    support_month: { id: "support_month", label: "Created Month", field: "createdAt", kind: "date", timeGrain: "month" },
    status: { id: "status", label: "Status", field: "status", kind: "enum" },
    path: { id: "path", label: "Path", field: "path", kind: "string" },
    language: { id: "language", label: "Language", field: "language", kind: "string" },
  },
  metrics: {
    support_tickets: { id: "support_tickets", label: "Tickets", field: "id", aggregation: "count", type: "number" },
  },
  filters: [
    { id: "status", label: "Status", field: "status", type: "enum", operators: ["eq", "in"] },
    { id: "path", label: "Path", field: "path", type: "string", operators: ["eq", "in"] },
  ],
};

const taskLibrary: SourceLibrary = {
  dimensions: {
    task_day: { id: "task_day", label: "Task Day", field: "createdAt", kind: "date", timeGrain: "day" },
    task_month: { id: "task_month", label: "Task Month", field: "createdAt", kind: "date", timeGrain: "month" },
    state: { id: "state", label: "State", field: "state", kind: "enum" },
    sla_status: { id: "sla_status", label: "SLA Status", field: "slaStatus", kind: "enum" },
    type: { id: "type", label: "Task Type", field: "type", kind: "enum" },
  },
  metrics: {
    tasks: { id: "tasks", label: "Tasks", field: "id", aggregation: "count", type: "number" },
  },
  filters: [
    { id: "state", label: "State", field: "state", type: "enum", operators: ["eq", "in"], options: ["pending", "in_progress", "done"] },
    { id: "sla_status", label: "SLA Status", field: "slaStatus", type: "enum", operators: ["eq", "in"], options: ["on_track", "at_risk", "breached"] },
  ],
};

const marketingLibrary: SourceLibrary = {
  dimensions: {
    campaign: { id: "campaign", label: "Campaign", field: "campaign", kind: "string", fallback: "unknown" },
    channel: { id: "channel", label: "Channel", field: "channel", kind: "string", fallback: "direct" },
    medium: { id: "medium", label: "Medium", field: "medium", kind: "string", fallback: "unspecified" },
    attributed_day: { id: "attributed_day", label: "Attributed Day", field: "createdAt", kind: "date", timeGrain: "day" },
    attributed_month: { id: "attributed_month", label: "Attributed Month", field: "createdAt", kind: "date", timeGrain: "month" },
  },
  metrics: {
    touches: { id: "touches", label: "Touches", field: "id", aggregation: "count", type: "number" },
    conversions: { id: "conversions", label: "Attributed Bookings", field: "conversions", aggregation: "sum", type: "number" },
  },
  filters: [
    { id: "channel", label: "Channel", field: "channel", type: "string", operators: ["eq", "in"] },
    { id: "campaign", label: "Campaign", field: "campaign", type: "string", operators: ["eq", "in"] },
  ],
};

const posLibrary: SourceLibrary = {
  dimensions: {
    sale_day: { id: "sale_day", label: "Sale Day", field: "createdAt", kind: "date", timeGrain: "day" },
    sale_week: { id: "sale_week", label: "Sale Week", field: "createdAt", kind: "date", timeGrain: "week" },
    sale_month: { id: "sale_month", label: "Sale Month", field: "createdAt", kind: "date", timeGrain: "month" },
    sale_hour: { id: "sale_hour", label: "Hour of Day", field: "createdAt", kind: "number" },
    payment_method: { id: "payment_method", label: "Payment Method", field: "method", kind: "enum" },
    product_category: { id: "product_category", label: "Product Category", field: "categoryName", kind: "string", fallback: "uncategorized" },
    product: { id: "product", label: "Product", field: "productName", kind: "string" },
    terminal: { id: "terminal", label: "Terminal", field: "terminalId", kind: "string", fallback: "unknown" },
    status: { id: "status", label: "Status", field: "status", kind: "enum" },
  },
  metrics: {
    transactions: { id: "transactions", label: "Transactions", field: "id", aggregation: "count", type: "number" },
    gross_sales: { id: "gross_sales", label: "Gross Sales", field: "grossCents", aggregation: "sum", type: "currency", format: "currency" },
    net_sales: { id: "net_sales", label: "Net Sales", field: "netCents", aggregation: "sum", type: "currency", format: "currency" },
    tax_collected: { id: "tax_collected", label: "Tax Collected", field: "taxCents", aggregation: "sum", type: "currency", format: "currency" },
    discounts: { id: "discounts", label: "Discounts", field: "discountCents", aggregation: "sum", type: "currency", format: "currency" },
    items_sold: { id: "items_sold", label: "Items Sold", field: "qty", aggregation: "sum", type: "number" },
    avg_ticket: { id: "avg_ticket", label: "Avg Ticket", field: "grossCents", aggregation: "avg", type: "currency", format: "currency" },
    avg_items: { id: "avg_items", label: "Avg Items/Txn", field: "itemCount", aggregation: "avg", type: "number" },
  },
  filters: [
    { id: "status", label: "Status", field: "status", type: "enum", operators: ["eq", "in"], options: ["open", "checked_out", "void"] },
    { id: "payment_method", label: "Payment Method", field: "method", type: "enum", operators: ["eq", "in"], options: ["card", "cash", "gift", "store_credit", "charge_to_site"] },
    { id: "terminal", label: "Terminal", field: "terminalId", type: "string", operators: ["eq", "in"] },
  ],
};

const tillLibrary: SourceLibrary = {
  dimensions: {
    session_day: { id: "session_day", label: "Session Day", field: "openedAt", kind: "date", timeGrain: "day" },
    session_month: { id: "session_month", label: "Session Month", field: "openedAt", kind: "date", timeGrain: "month" },
    movement_day: { id: "movement_day", label: "Movement Day", field: "createdAt", kind: "date", timeGrain: "day" },
    movement_type: { id: "movement_type", label: "Movement Type", field: "type", kind: "enum" },
    terminal: { id: "terminal", label: "Terminal", field: "terminalId", kind: "string", fallback: "unknown" },
    session_status: { id: "session_status", label: "Session Status", field: "status", kind: "enum" },
    cashier: { id: "cashier", label: "Cashier", field: "openedByUserId", kind: "string" },
  },
  metrics: {
    sessions: { id: "sessions", label: "Sessions", field: "id", aggregation: "count", type: "number" },
    movements: { id: "movements", label: "Movements", field: "id", aggregation: "count", type: "number" },
    movement_amount: { id: "movement_amount", label: "Movement Amount", field: "amountCents", aggregation: "sum", type: "currency", format: "currency" },
    opening_float: { id: "opening_float", label: "Opening Float", field: "openingFloatCents", aggregation: "sum", type: "currency", format: "currency" },
    expected_close: { id: "expected_close", label: "Expected Close", field: "expectedCloseCents", aggregation: "sum", type: "currency", format: "currency" },
    counted_close: { id: "counted_close", label: "Counted Close", field: "countedCloseCents", aggregation: "sum", type: "currency", format: "currency" },
    over_short: { id: "over_short", label: "Over/Short", field: "overShortCents", aggregation: "sum", type: "currency", format: "currency" },
  },
  filters: [
    { id: "session_status", label: "Session Status", field: "status", type: "enum", operators: ["eq", "in"], options: ["open", "closed"] },
    { id: "movement_type", label: "Movement Type", field: "type", type: "enum", operators: ["eq", "in"], options: ["cash_sale", "cash_refund", "paid_in", "paid_out", "adjustment"] },
    { id: "terminal", label: "Terminal", field: "terminalId", type: "string", operators: ["eq", "in"] },
  ],
};

// Inventory expiration & batch tracking library
const inventoryBatchLibrary: SourceLibrary = {
  dimensions: {
    expiration_day: { id: "expiration_day", label: "Expiration Day", field: "expirationDate", kind: "date", timeGrain: "day" },
    expiration_week: { id: "expiration_week", label: "Expiration Week", field: "expirationDate", kind: "date", timeGrain: "week" },
    expiration_month: { id: "expiration_month", label: "Expiration Month", field: "expirationDate", kind: "date", timeGrain: "month" },
    received_day: { id: "received_day", label: "Received Day", field: "receivedDate", kind: "date", timeGrain: "day" },
    expiration_tier: { id: "expiration_tier", label: "Expiration Tier", field: "tier", kind: "enum" },
    product: { id: "product", label: "Product", field: "productName", kind: "string" },
    product_category: { id: "product_category", label: "Category", field: "categoryName", kind: "string", fallback: "uncategorized" },
    location: { id: "location", label: "Location", field: "locationName", kind: "string", fallback: "shared" },
  },
  metrics: {
    batches: { id: "batches", label: "Batches", field: "id", aggregation: "count", type: "number" },
    qty_remaining: { id: "qty_remaining", label: "Qty Remaining", field: "qtyRemaining", aggregation: "sum", type: "number" },
    value_at_cost: { id: "value_at_cost", label: "Value at Cost", field: "valueCents", aggregation: "sum", type: "currency", format: "currency" },
    days_until_expiration: { id: "days_until_expiration", label: "Days Until Expiration", field: "daysRemaining", aggregation: "avg", type: "number" },
  },
  filters: [
    { id: "expiration_tier", label: "Expiration Tier", field: "tier", type: "enum", operators: ["eq", "in"], options: ["fresh", "warning", "critical", "expired"] },
    { id: "product", label: "Product", field: "productId", type: "string", operators: ["eq", "in"] },
    { id: "location", label: "Location", field: "locationId", type: "string", operators: ["eq", "in"] },
  ],
};

// Slow-moving inventory library
const slowMovingLibrary: SourceLibrary = {
  dimensions: {
    last_sale_day: { id: "last_sale_day", label: "Last Sale Day", field: "lastSaleDate", kind: "date", timeGrain: "day" },
    last_sale_month: { id: "last_sale_month", label: "Last Sale Month", field: "lastSaleDate", kind: "date", timeGrain: "month" },
    product: { id: "product", label: "Product", field: "productName", kind: "string" },
    product_category: { id: "product_category", label: "Category", field: "categoryName", kind: "string", fallback: "uncategorized" },
    days_since_sale_bucket: { id: "days_since_sale_bucket", label: "Days Since Sale", field: "daysSinceLastSale", kind: "number" },
  },
  metrics: {
    products: { id: "products", label: "Products", field: "id", aggregation: "count", type: "number" },
    qty_on_hand: { id: "qty_on_hand", label: "Qty on Hand", field: "stockQty", aggregation: "sum", type: "number" },
    value_at_retail: { id: "value_at_retail", label: "Value at Retail", field: "valueCents", aggregation: "sum", type: "currency", format: "currency" },
    avg_days_since_sale: { id: "avg_days_since_sale", label: "Avg Days Since Sale", field: "daysSinceLastSale", aggregation: "avg", type: "number" },
  },
  filters: [
    { id: "category", label: "Category", field: "categoryId", type: "string", operators: ["eq", "in"] },
    { id: "min_days", label: "Min Days Since Sale", field: "daysSinceLastSale", type: "number", operators: ["gte"] },
  ],
};

// Markdown tracking library
const markdownLibrary: SourceLibrary = {
  dimensions: {
    markdown_day: { id: "markdown_day", label: "Markdown Day", field: "createdAt", kind: "date", timeGrain: "day" },
    markdown_week: { id: "markdown_week", label: "Markdown Week", field: "createdAt", kind: "date", timeGrain: "week" },
    markdown_month: { id: "markdown_month", label: "Markdown Month", field: "createdAt", kind: "date", timeGrain: "month" },
    product: { id: "product", label: "Product", field: "productName", kind: "string" },
    product_category: { id: "product_category", label: "Category", field: "categoryName", kind: "string", fallback: "uncategorized" },
    markdown_rule: { id: "markdown_rule", label: "Markdown Rule", field: "markdownRuleId", kind: "string" },
    days_until_expiration: { id: "days_until_expiration", label: "Days Until Expiration", field: "daysUntilExpiration", kind: "number" },
  },
  metrics: {
    markdown_applications: { id: "markdown_applications", label: "Markdowns Applied", field: "id", aggregation: "count", type: "number" },
    discount_total: { id: "discount_total", label: "Discount Total", field: "discountCents", aggregation: "sum", type: "currency", format: "currency" },
    qty_sold: { id: "qty_sold", label: "Qty Sold", field: "qty", aggregation: "sum", type: "number" },
    original_value: { id: "original_value", label: "Original Value", field: "originalPriceCents", aggregation: "sum", type: "currency", format: "currency" },
    markdown_value: { id: "markdown_value", label: "Markdown Value", field: "markdownPriceCents", aggregation: "sum", type: "currency", format: "currency" },
  },
  filters: [
    { id: "product", label: "Product", field: "productId", type: "string", operators: ["eq", "in"] },
    { id: "markdown_rule", label: "Markdown Rule", field: "markdownRuleId", type: "string", operators: ["eq", "in"] },
  ],
};

export const libraries: Record<ReportSource, SourceLibrary> = {
  reservation: reservationLibrary,
  payment: paymentLibrary,
  ledger: ledgerLibrary,
  payout: payoutLibrary,
  support: supportLibrary,
  task: taskLibrary,
  marketing: marketingLibrary,
  pos: posLibrary,
  till: tillLibrary,
  inventory_batch: inventoryBatchLibrary,
  slow_moving: slowMovingLibrary,
  markdown: markdownLibrary,
};

const bookingTemplates: ReportSpec[] = [
  { id: "bookings.daily_bookings", name: "Daily bookings", category: "Bookings", source: "reservation", dimensions: ["booked_day"], metrics: ["bookings", "revenue", "paid"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "bookings.weekly_bookings", name: "Weekly bookings", category: "Bookings", source: "reservation", dimensions: ["booked_week"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "bookings.monthly_revenue", name: "Monthly revenue", category: "Bookings", source: "reservation", dimensions: ["booked_month"], metrics: ["revenue", "adr"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "bookings.channel_mix", name: "Channel mix", category: "Bookings", source: "reservation", dimensions: ["source"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "bookings.status_funnel", name: "Status funnel", category: "Bookings", source: "reservation", dimensions: ["status"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "bookings.lead_time", name: "Lead time distribution", category: "Bookings", source: "reservation", dimensions: ["lead_time_bucket"], metrics: ["bookings", "lead_time_avg"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "bookings.length_of_stay", name: "Length of stay", category: "Bookings", source: "reservation", dimensions: ["length_of_stay"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "bookings.promo_performance", name: "Promo code performance", category: "Bookings", source: "reservation", dimensions: ["promo_code"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table", "pie"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "bookings.stay_type_mix", name: "Stay type mix", category: "Bookings", source: "reservation", dimensions: ["stay_type"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["pie", "table", "bar"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "bookings.rig_type_mix", name: "Rig type mix", category: "Bookings", source: "reservation", dimensions: ["rig_type"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["pie", "table", "bar"], defaultChart: "pie", sampling: { limit: 5000 } },
  { id: "bookings.arrival_month", name: "Arrivals by month", category: "Bookings", source: "reservation", dimensions: ["arrival_month"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 5000 } },
  { id: "bookings.arrival_day", name: "Arrivals by day", category: "Bookings", source: "reservation", dimensions: ["arrival_day"], metrics: ["bookings", "revenue"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 5000 } },
  { id: "bookings.cancellation_rate", name: "Cancellation share", category: "Bookings", source: "reservation", dimensions: ["status"], metrics: ["bookings"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["pie", "table"], defaultChart: "pie", sampling: { limit: 5000 }, heavy: false },
  { id: "bookings.adr_by_source", name: "ADR by source", category: "Bookings", source: "reservation", dimensions: ["source"], metrics: ["adr", "revenue"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "bookings.balance_by_status", name: "Balance by status", category: "Bookings", source: "reservation", dimensions: ["status"], metrics: ["balance", "paid"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
];

const inventoryTemplates: ReportSpec[] = [
  { id: "inventory.arrival_load_day", name: "Arrival load by day", category: "Inventory", source: "reservation", dimensions: ["arrival_day"], metrics: ["bookings"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "inventory.arrival_load_month", name: "Arrival load by month", category: "Inventory", source: "reservation", dimensions: ["arrival_month"], metrics: ["bookings"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "line", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "inventory.status_mix", name: "Reservation status mix", category: "Inventory", source: "reservation", dimensions: ["status"], metrics: ["bookings"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "inventory.stay_type_load", name: "Stay type load", category: "Inventory", source: "reservation", dimensions: ["stay_type"], metrics: ["bookings"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "inventory.rig_type_load", name: "Rig type load", category: "Inventory", source: "reservation", dimensions: ["rig_type"], metrics: ["bookings"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "inventory.lead_time_forecast", name: "Lead time forecast", category: "Inventory", source: "reservation", dimensions: ["lead_time_bucket"], metrics: ["bookings"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 }, heavy: true },
  { id: "inventory.length_of_stay_mix", name: "Length-of-stay mix", category: "Inventory", source: "reservation", dimensions: ["length_of_stay"], metrics: ["bookings"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "inventory.arrival_vs_booked", name: "Arrival vs booked month", category: "Inventory", source: "reservation", dimensions: ["arrival_month", "booked_month"], metrics: ["bookings"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
  { id: "inventory.promo_impact", name: "Promo impact on occupancy", category: "Inventory", source: "reservation", dimensions: ["promo_code"], metrics: ["bookings", "adr"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "inventory.balance_watch", name: "Balance watchlist", category: "Inventory", source: "reservation", dimensions: ["status"], metrics: ["balance"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 3000 } },
];

const paymentTemplates: ReportSpec[] = [
  { id: "payments.daily_cashflow", name: "Daily cashflow", category: "Payments", source: "payment", dimensions: ["paid_day"], metrics: ["amount", "payments"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "payments.weekly_cashflow", name: "Weekly cashflow", category: "Payments", source: "payment", dimensions: ["paid_week"], metrics: ["amount"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "payments.method_mix", name: "Method mix", category: "Payments", source: "payment", dimensions: ["method"], metrics: ["amount", "payments"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "payments.direction_mix", name: "Charges vs refunds", category: "Payments", source: "payment", dimensions: ["direction"], metrics: ["amount", "payments"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "payments.refund_rate", name: "Refund rate", category: "Payments", source: "payment", dimensions: ["direction"], metrics: ["payments"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["pie", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "payments.fees", name: "Processor fees", category: "Payments", source: "payment", dimensions: ["paid_month"], metrics: ["fees", "amount"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "payments.avg_ticket", name: "Average ticket", category: "Payments", source: "payment", dimensions: ["paid_month"], metrics: ["amount"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "payments.charge_volume", name: "Charge volume", category: "Payments", source: "payment", dimensions: ["paid_month"], metrics: ["payments"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "payments.method_success", name: "Method success rate", category: "Payments", source: "payment", dimensions: ["method"], metrics: ["payments"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 }, heavy: false },
  { id: "payments.payout_alignment", name: "Payout alignment", category: "Payments", source: "payout", dimensions: ["payout_month", "status"], metrics: ["payout_amount", "payout_fee"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 4000 }, heavy: true },
];

const ledgerTemplates: ReportSpec[] = [
  { id: "ledger.entries_month", name: "Ledger entries by month", category: "Payments", source: "ledger", dimensions: ["ledger_month"], metrics: ["ledger_amount", "ledger_entries"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "ledger.gl_code_mix", name: "GL code mix", category: "Payments", source: "ledger", dimensions: ["gl_code"], metrics: ["ledger_amount", "ledger_entries"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "ledger.debits_credits", name: "Debits vs credits", category: "Payments", source: "ledger", dimensions: ["direction"], metrics: ["ledger_amount", "ledger_entries"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 5000 } },
  { id: "ledger.daily_entries", name: "Daily ledger entries", category: "Payments", source: "ledger", dimensions: ["ledger_day"], metrics: ["ledger_amount"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "ledger.monthly_net", name: "Monthly net ledger", category: "Payments", source: "ledger", dimensions: ["ledger_month", "direction"], metrics: ["ledger_amount"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

const operationsTemplates: ReportSpec[] = [
  { id: "ops.tasks_by_state", name: "Tasks by state", category: "Operations", source: "task", dimensions: ["state"], metrics: ["tasks"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "ops.tasks_by_day", name: "Tasks by day", category: "Operations", source: "task", dimensions: ["task_day"], metrics: ["tasks"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "ops.tasks_by_sla", name: "Tasks by SLA status", category: "Operations", source: "task", dimensions: ["sla_status"], metrics: ["tasks"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "ops.tasks_by_type", name: "Tasks by type", category: "Operations", source: "task", dimensions: ["type"], metrics: ["tasks"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["pie", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "ops.support_volume_day", name: "Support volume by day", category: "Operations", source: "support", dimensions: ["support_day"], metrics: ["support_tickets"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "ops.support_status", name: "Support by status", category: "Operations", source: "support", dimensions: ["status"], metrics: ["support_tickets"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "ops.support_paths", name: "Support by path", category: "Operations", source: "support", dimensions: ["path"], metrics: ["support_tickets"], defaultTimeRange: { preset: "last_60_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "ops.support_language", name: "Support by language", category: "Operations", source: "support", dimensions: ["language"], metrics: ["support_tickets"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "ops.tasks_month", name: "Tasks by month", category: "Operations", source: "task", dimensions: ["task_month"], metrics: ["tasks"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 5000 } },
  { id: "ops.tasks_state_month", name: "Task state by month", category: "Operations", source: "task", dimensions: ["task_month", "state"], metrics: ["tasks"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

const marketingTemplates: ReportSpec[] = [
  { id: "marketing.channel_mix", name: "Channel mix", category: "Marketing", source: "marketing", dimensions: ["channel"], metrics: ["touches"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 5000 } },
  { id: "marketing.campaign_performance", name: "Campaign performance", category: "Marketing", source: "marketing", dimensions: ["campaign"], metrics: ["touches", "conversions"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "marketing.medium_mix", name: "Medium mix", category: "Marketing", source: "marketing", dimensions: ["medium"], metrics: ["touches"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 5000 } },
  { id: "marketing.channel_trend", name: "Channel trend", category: "Marketing", source: "marketing", dimensions: ["attributed_month"], metrics: ["touches"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 5000 } },
  { id: "marketing.campaign_trend", name: "Campaign trend", category: "Marketing", source: "marketing", dimensions: ["attributed_month", "campaign"], metrics: ["touches"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
  { id: "marketing.conversion_by_channel", name: "Conversions by channel", category: "Marketing", source: "marketing", dimensions: ["channel"], metrics: ["conversions"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "marketing.conversion_by_campaign", name: "Conversions by campaign", category: "Marketing", source: "marketing", dimensions: ["campaign"], metrics: ["conversions"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "marketing.channel_medium", name: "Channel by medium", category: "Marketing", source: "marketing", dimensions: ["channel", "medium"], metrics: ["touches"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

const posTemplates: ReportSpec[] = [
  // Sales reports
  { id: "pos.daily_sales", name: "Daily POS sales", category: "POS", source: "pos", dimensions: ["sale_day"], metrics: ["transactions", "gross_sales", "net_sales", "tax_collected"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "pos.weekly_sales", name: "Weekly POS sales", category: "POS", source: "pos", dimensions: ["sale_week"], metrics: ["transactions", "gross_sales", "avg_ticket"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "pos.monthly_sales", name: "Monthly POS sales", category: "POS", source: "pos", dimensions: ["sale_month"], metrics: ["transactions", "gross_sales", "net_sales", "discounts"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["line", "bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "pos.hourly_sales", name: "Sales by hour", category: "POS", source: "pos", dimensions: ["sale_hour"], metrics: ["transactions", "gross_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },

  // Mix reports
  { id: "pos.payment_method_mix", name: "Payment method mix", category: "POS", source: "pos", dimensions: ["payment_method"], metrics: ["transactions", "gross_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "pos.category_sales", name: "Sales by category", category: "POS", source: "pos", dimensions: ["product_category"], metrics: ["items_sold", "gross_sales", "net_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "pos.product_performance", name: "Product performance", category: "POS", source: "pos", dimensions: ["product"], metrics: ["items_sold", "gross_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "pos.terminal_sales", name: "Sales by terminal", category: "POS", source: "pos", dimensions: ["terminal"], metrics: ["transactions", "gross_sales", "avg_ticket"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },

  // Analysis reports
  { id: "pos.avg_ticket_trend", name: "Avg ticket trend", category: "POS", source: "pos", dimensions: ["sale_day"], metrics: ["avg_ticket", "avg_items"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "pos.discount_analysis", name: "Discount analysis", category: "POS", source: "pos", dimensions: ["sale_month"], metrics: ["discounts", "gross_sales"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "pos.tax_collected", name: "Tax collected", category: "POS", source: "pos", dimensions: ["sale_month"], metrics: ["tax_collected", "net_sales"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "pos.void_analysis", name: "Void transactions", category: "POS", source: "pos", dimensions: ["sale_day", "status"], metrics: ["transactions", "gross_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 4000 } },

  // Cross-dimensional
  { id: "pos.category_by_day", name: "Category sales by day", category: "POS", source: "pos", dimensions: ["sale_day", "product_category"], metrics: ["gross_sales"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
  { id: "pos.payment_trend", name: "Payment method trend", category: "POS", source: "pos", dimensions: ["sale_month", "payment_method"], metrics: ["transactions", "gross_sales"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

const tillTemplates: ReportSpec[] = [
  // Session reports
  { id: "till.daily_sessions", name: "Daily till sessions", category: "POS", source: "till", dimensions: ["session_day"], metrics: ["sessions", "opening_float", "expected_close"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "till.over_short_daily", name: "Over/short by day", category: "POS", source: "till", dimensions: ["session_day"], metrics: ["over_short", "sessions"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "till.over_short_monthly", name: "Over/short by month", category: "POS", source: "till", dimensions: ["session_month"], metrics: ["over_short", "sessions"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "till.cashier_performance", name: "Cashier over/short", category: "POS", source: "till", dimensions: ["cashier"], metrics: ["sessions", "over_short"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },

  // Movement reports
  { id: "till.movement_types", name: "Movement by type", category: "POS", source: "till", dimensions: ["movement_type"], metrics: ["movements", "movement_amount"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["pie", "bar", "table"], defaultChart: "pie", sampling: { limit: 4000 } },
  { id: "till.daily_movements", name: "Daily movements", category: "POS", source: "till", dimensions: ["movement_day"], metrics: ["movements", "movement_amount"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "till.terminal_reconciliation", name: "Terminal reconciliation", category: "POS", source: "till", dimensions: ["terminal"], metrics: ["sessions", "expected_close", "counted_close", "over_short"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 4000 } },

  // Cross-dimensional
  { id: "till.movement_by_day_type", name: "Movements by day and type", category: "POS", source: "till", dimensions: ["movement_day", "movement_type"], metrics: ["movements", "movement_amount"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

// Inventory Expiration & Batch Tracking Reports
const expirationTemplates: ReportSpec[] = [
  { id: "expiration.summary", name: "Expiration summary", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["expiration_tier"], metrics: ["batches", "qty_remaining", "value_at_cost"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "expiration.by_product", name: "Expiring by product", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["product"], metrics: ["qty_remaining", "days_until_expiration"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "expiration.by_category", name: "Expiring by category", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["product_category"], metrics: ["batches", "qty_remaining", "value_at_cost"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "expiration.by_location", name: "Expiring by location", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["location"], metrics: ["batches", "qty_remaining"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "expiration.timeline", name: "Expiration timeline", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["expiration_week"], metrics: ["batches", "qty_remaining"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 5000 } },
  { id: "expiration.at_risk_value", name: "At-risk inventory value", category: "Inventory Expiration", source: "inventory_batch", dimensions: ["expiration_tier", "product_category"], metrics: ["value_at_cost"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 5000 }, heavy: true },
];

// Slow-Moving Inventory Reports
const slowMovingTemplates: ReportSpec[] = [
  { id: "slow_moving.summary", name: "Slow-moving summary", category: "Inventory Expiration", source: "slow_moving", dimensions: ["days_since_sale_bucket"], metrics: ["products", "qty_on_hand", "value_at_retail"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "slow_moving.by_product", name: "Slow-moving products", category: "Inventory Expiration", source: "slow_moving", dimensions: ["product"], metrics: ["qty_on_hand", "avg_days_since_sale", "value_at_retail"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["table", "bar"], defaultChart: "table", sampling: { limit: 5000 } },
  { id: "slow_moving.by_category", name: "Slow-moving by category", category: "Inventory Expiration", source: "slow_moving", dimensions: ["product_category"], metrics: ["products", "value_at_retail"], defaultTimeRange: { preset: "last_180_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "slow_moving.never_sold", name: "Never-sold products", category: "Inventory Expiration", source: "slow_moving", dimensions: ["product"], metrics: ["qty_on_hand", "value_at_retail"], defaultTimeRange: { preset: "all_time" }, chartTypes: ["table"], defaultChart: "table", sampling: { limit: 3000 } },
];

// Markdown & Shrinkage Reports
const markdownTemplates: ReportSpec[] = [
  { id: "markdown.daily", name: "Daily markdowns", category: "Inventory Expiration", source: "markdown", dimensions: ["markdown_day"], metrics: ["markdown_applications", "discount_total", "qty_sold"], defaultTimeRange: { preset: "last_30_days" }, chartTypes: ["line", "bar", "table"], defaultChart: "line", sampling: { limit: 4000 } },
  { id: "markdown.weekly", name: "Weekly markdowns", category: "Inventory Expiration", source: "markdown", dimensions: ["markdown_week"], metrics: ["markdown_applications", "discount_total"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "markdown.by_product", name: "Markdowns by product", category: "Inventory Expiration", source: "markdown", dimensions: ["product"], metrics: ["discount_total", "qty_sold"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 5000 } },
  { id: "markdown.by_category", name: "Markdowns by category", category: "Inventory Expiration", source: "markdown", dimensions: ["product_category"], metrics: ["discount_total", "qty_sold", "markdown_applications"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "pie", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "markdown.by_rule", name: "Markdowns by rule", category: "Inventory Expiration", source: "markdown", dimensions: ["markdown_rule"], metrics: ["markdown_applications", "discount_total"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "markdown.shrinkage", name: "Markdown shrinkage", category: "Inventory Expiration", source: "markdown", dimensions: ["markdown_month"], metrics: ["discount_total", "original_value", "markdown_value"], defaultTimeRange: { preset: "last_12_months" }, chartTypes: ["bar", "line", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
  { id: "markdown.expiry_trend", name: "Days-to-expiry trend", category: "Inventory Expiration", source: "markdown", dimensions: ["days_until_expiration"], metrics: ["qty_sold", "discount_total"], defaultTimeRange: { preset: "last_90_days" }, chartTypes: ["bar", "table"], defaultChart: "bar", sampling: { limit: 4000 } },
];

const definitions: ReportSpec[] = [
  ...bookingTemplates,
  ...inventoryTemplates,
  ...paymentTemplates,
  ...ledgerTemplates,
  ...operationsTemplates,
  ...marketingTemplates,
  ...posTemplates,
  ...tillTemplates,
  ...expirationTemplates,
  ...slowMovingTemplates,
  ...markdownTemplates,
];

export function getReportCatalog(opts?: { category?: string; search?: string; includeHeavy?: boolean }) {
  const search = opts?.search?.toLowerCase();
  return definitions.filter((def) => {
    if (opts?.category && def.category !== opts.category) return false;
    if (!opts?.includeHeavy && def.heavy) return false;
    if (search && !`${def.name} ${def.id} ${def.description ?? ""}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

export function getReportSpec(id: string) {
  return definitions.find((d) => d.id === id);
}

export function resolveDimension(source: ReportSource, id: string) {
  return libraries[source]?.dimensions[id];
}

export function resolveMetric(source: ReportSource, id: string) {
  return libraries[source]?.metrics[id];
}

export function resolveFilters(source: ReportSource) {
  return libraries[source]?.filters ?? [];
}

export function registrySize() {
  return definitions.length;
}

// Scaling hint: new reports can be added by combining existing dimensions/metrics
// and time grains; templates above cover five domains. Adding site_class or region
// dimensions, or cloning time grains, easily grows the catalog past 100 without code changes.
