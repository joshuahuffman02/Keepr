# 🤖 AI-First Development Setup

**Your tech stack is now optimized for building with AI (Claude)**

This document explains all the safety nets in place to catch bugs before they become production issues.

---

## ✅ What's Been Added

### 1. **Zod** - Runtime Validation

**Installed:** `zod` + `zod-prisma-types`
**Purpose:** Validates data at runtime (TypeScript only checks at compile time)

**Why critical for AI development:**

- TypeScript says `price: number` but at runtime it could be `"abc"` or `null`
- Zod catches this BEFORE it hits your database or Stripe
- Essential for money/payments (validates amounts are actually numbers)

**Example:**

```typescript
import { z } from "zod";

// Define schema
const PaymentSchema = z.object({
  amount_cents: z.number().int().positive().max(100000000), // Max $1M
  currency: z.enum(["USD", "CAD"]),
  customer_id: z.string().min(1),
});

// Validate input
try {
  const payment = PaymentSchema.parse(requestBody);
  // ✅ payment is guaranteed to be valid
  processPayment(payment);
} catch (error) {
  // ❌ Invalid data - return 400 error
  return res.status(400).json({ error: "Invalid payment data" });
}
```

**Where to use:**

- ✅ All payment endpoints (CRITICAL)
- ✅ All endpoints that handle money
- ✅ User input from forms
- ✅ External API responses
- ✅ Environment variables

---

### 2. **Sentry** - Error Tracking

**Installed:** `@sentry/node` (API) + `@sentry/nextjs` (Web)
**Purpose:** Catches errors in production and alerts you

**Why critical for AI development:**

- You need to know when AI-generated code fails
- See errors before users complain
- Get stack traces showing exactly what broke
- **Free tier:** 10,000 errors/month

**Setup:**

1. Create free account: https://sentry.io
2. Get your DSN (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
3. Add to `.env`:
   ```
   SENTRY_DSN=your_dsn_here
   ```

**Initialize in API** (`platform/apps/api/src/main.ts`):

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of requests
});
```

**Initialize in Web** (`platform/apps/web/sentry.client.config.ts`):

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**What you'll get:**

- Email alerts when errors happen
- Stack traces showing exactly where code failed
- User context (which user hit the error)
- Request details (URL, headers, etc.)

---

### 3. **Vitest** - Automated Testing

**Installed:** `vitest` + `@vitest/ui` (both apps)
**Purpose:** Tests run automatically when Claude writes code

**Why critical for AI development:**

- You can't manually test everything Claude writes
- Tests catch bugs before deployment
- Documents how code should work
- Safety net for refactoring

**Run tests:**

```bash
# API tests
cd platform/apps/api
pnpm test

# Web tests
cd platform/apps/web
pnpm test

# Watch mode (re-runs on file changes)
pnpm test --watch

# UI mode (visual interface)
pnpm test --ui
```

**Example test** (`platform/apps/api/src/payments/payments.service.spec.ts`):

```typescript
import { describe, it, expect } from "vitest";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  describe("calculateTotal", () => {
    it("should calculate total correctly", () => {
      const service = new PaymentsService();
      const total = service.calculateTotal(1000, 5); // $10.00 * 5
      expect(total).toBe(5000); // $50.00
    });

    it("should throw error for negative amounts", () => {
      const service = new PaymentsService();
      expect(() => {
        service.calculateTotal(-1000, 5);
      }).toThrow("Amount must be positive");
    });
  });
});
```

**Test strategy:**

1. **Unit tests** - Test individual functions
2. **Integration tests** - Test API endpoints
3. **E2E tests** - Test full user flows (with Playwright)

---

### 4. **Playwright** - End-to-End Testing

**Installed:** `@playwright/test` (web app)
**Purpose:** Tests your app like a real user would

**Example** (`platform/apps/web/e2e/reservation.spec.ts`):

```typescript
import { test, expect } from "@playwright/test";

test("user can create reservation", async ({ page }) => {
  // Go to booking page
  await page.goto("http://localhost:3000/book");

  // Fill out form
  await page.fill('[name="arrival"]', "2025-06-15");
  await page.fill('[name="departure"]', "2025-06-20");
  await page.click('button[type="submit"]');

  // Check success message appears
  await expect(page.locator("text=Reservation created")).toBeVisible();
});
```

**Run Playwright tests:**

```bash
cd platform/apps/web
pnpm exec playwright test

# With UI
pnpm exec playwright test --ui

# Generate tests by recording
pnpm exec playwright codegen http://localhost:3000
```

---

## 🎯 The Safety Net (How It All Works Together)

**Before (No safety nets):**

```
Claude writes code →
Deploy →
💥 Runtime error with customer payment →
Customer loses money →
You find out days later
```

**Now (With safety nets):**

```
Claude writes code →
Zod validates input ✅ →
Tests run ✅ →
TypeScript checks types ✅ →
Deploy →
Sentry catches any issues ✅ →
Alert sent to you within 1 minute ✅ →
You fix before customer notices ✅
```

---

## 💰 Example: Payment Processing (All Layers)

**1. Zod validation:**

```typescript
const PaymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  payment_method_id: z.string(),
});

const validatedInput = PaymentSchema.parse(req.body);
```

**2. TypeScript types:**

```typescript
interface Payment {
  amount_cents: number;
  payment_method_id: string;
}
```

**3. Tests:**

```typescript
it("should process payment successfully", async () => {
  const result = await service.processPayment({
    amount_cents: 9999,
    payment_method_id: "pm_123",
  });
  expect(result.success).toBe(true);
});
```

**4. Sentry (catches production errors):**

```typescript
try {
  await stripe.charges.create(params);
} catch (error) {
  Sentry.captureException(error);
  throw new BadRequestException("Payment failed");
}
```

**Result:** Multiple layers catching bugs at different stages!

---

## 📋 Daily Workflow (Building with Claude)

### Morning Routine:

1. Check Sentry for any overnight errors
2. Run tests: `pnpm test`
3. Start coding with Claude

### When Claude Writes Code:

1. Claude writes feature
2. Tests run automatically (via hook)
3. If tests pass → good to go! ✅
4. If tests fail → Claude fixes them ❌

### Before Deploying:

1. Run full test suite: `pnpm test`
2. Check no TypeScript errors: `pnpm build`
3. Deploy to Railway
4. Monitor Sentry for 10 minutes

### After Deploying:

1. Check Sentry dashboard
2. Run smoke test on production
3. If errors appear → rollback immediately

---

## 🚨 Critical Rules for AI Development

**1. ALWAYS validate money with Zod:**

```typescript
// ❌ WRONG
const amount = req.body.amount;
await stripe.charges.create({ amount });

// ✅ RIGHT
const { amount_cents } = PaymentSchema.parse(req.body);
await stripe.charges.create({ amount: amount_cents });
```

**2. ALWAYS write tests for critical features:**

- ✅ Payment processing
- ✅ Authentication
- ✅ Reservation creation
- ✅ Availability checking
- ✅ Pricing calculations

**3. ALWAYS check Sentry after deploying:**

- Check within 10 minutes of deployment
- Set up Slack/email alerts
- Fix errors within 1 hour

**4. NEVER skip validation on external data:**

- ✅ User input
- ✅ API responses
- ✅ Webhook payloads
- ✅ Environment variables

---

## 📊 Monitoring Dashboard (What to Watch)

**Sentry Dashboard:**

- Error rate (should be < 1%)
- New errors (investigate immediately)
- Performance issues (slow endpoints)

**Test Coverage:**

- Aim for 70%+ coverage on critical paths
- 100% coverage on payment code
- Run tests before every deployment

**Key Metrics:**

```bash
# Check test coverage
pnpm test -- --coverage

# Check bundle size
pnpm build

# Check TypeScript errors
pnpm exec tsc --noEmit
```

---

## 🔧 Troubleshooting

**Tests failing?**

```bash
# Run in watch mode to see details
pnpm test --watch

# Run specific test file
pnpm test payments.service.spec.ts

# See coverage
pnpm test -- --coverage
```

**Sentry not working?**

1. Check DSN is set in `.env`
2. Verify Sentry.init() is called
3. Trigger test error: `throw new Error('Test');`
4. Check Sentry dashboard in 1-2 minutes

**Zod validation failing?**

```typescript
// Debug schema issues
try {
  schema.parse(data);
} catch (error) {
  console.log(error.issues); // Shows exactly what's invalid
}
```

---

## 🎓 Next Steps

**Week 1: Learn the tools**

- [ ] Create Sentry account
- [ ] Write first Zod schema
- [ ] Write first test
- [ ] Trigger test error in Sentry

**Week 2: Add to existing code**

- [ ] Add Zod to payment endpoints
- [ ] Add tests for critical features
- [ ] Set up Sentry alerts

**Week 3: Make it automatic**

- [ ] Tests run on every commit (via hooks)
- [ ] Sentry alerts go to Slack
- [ ] No deploy without passing tests

---

## 📚 Resources

**Zod:**

- Docs: https://zod.dev
- Patterns: Ask Claude "show me Zod validation for X"

**Sentry:**

- Docs: https://docs.sentry.io
- Setup: https://sentry.io/signup

**Vitest:**

- Docs: https://vitest.dev
- Examples: Ask Claude "write tests for X"

**Playwright:**

- Docs: https://playwright.dev
- Codegen: `pnpm exec playwright codegen`

---

## 💡 Pro Tips

1. **Use Zod for environment variables**

   ```typescript
   const EnvSchema = z.object({
     DATABASE_URL: z.string().url(),
     STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
   });

   const env = EnvSchema.parse(process.env);
   ```

2. **Use Sentry breadcrumbs for debugging**

   ```typescript
   Sentry.addBreadcrumb({
     message: "Processing payment",
     data: { amount_cents: 9999 },
   });
   ```

3. **Use snapshot testing for complex objects**

   ```typescript
   expect(reservation).toMatchSnapshot();
   ```

4. **Use Playwright to generate tests**
   ```bash
   pnpm exec playwright codegen
   # Click around your app, it writes the test for you!
   ```

---

## ⚡ Summary

**You now have 4 layers of protection:**

1. **Zod** - Validates data at runtime
2. **Sentry** - Catches production errors
3. **Vitest** - Tests code automatically
4. **Playwright** - Tests like a real user

**Your AI-first workflow:**

- Claude writes code
- Tests verify it works
- Zod validates data
- Sentry catches any issues
- You fix before customers notice

**Next time Claude writes code, tests will run automatically and catch bugs before deployment!** 🎉
