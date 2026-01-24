# 🦀 Rust Migration Plan

**Status:** Pre-implementation (waiting for first customer)
**Purpose:** Move critical code to Rust for safety and correctness
**Timeline:** After achieving product-market fit

## Why Rust?

> "Rust is a perfect language for agents, given that if it compiles it's ~correct"
> — Greg Brockman, Former CTO of OpenAI

Since this project is built with AI assistance (Claude), Rust's compiler provides a critical safety net:

- **TypeScript:** Compiles ✅ → Runs with bugs 💥
- **Rust:** Compiles ✅ → Actually works ✅

## Critical Components to Migrate

### Priority 1: Payment Processing 🔴 CRITICAL

**Why:** Can't afford bugs with money
**Risk if not done:** Financial losses, chargebacks, legal issues
**Effort:** Medium (2-3 days)

**Files to migrate:**

- `platform/apps/api/src/payments/payments.service.ts`
- `platform/apps/api/src/payments/stripe.service.ts`

**New Rust service:**

```
platform/services/payment-processor-rs/
  src/
    main.rs           # HTTP server
    payments.rs       # Payment logic
    stripe.rs         # Stripe integration
  Cargo.toml
```

**API contract:**

```rust
POST /process-payment
{
  "amount_cents": 9999,
  "currency": "USD",
  "customer_id": "cust_123",
  "payment_method": "pm_card_visa"
}

Response:
{
  "success": true,
  "charge_id": "ch_123",
  "receipt_url": "https://..."
}
```

---

### Priority 2: Availability Calculator 🟡 HIGH

**Why:** Complex date/range logic prone to edge cases
**Risk if not done:** Double bookings, customer complaints
**Effort:** High (4-5 days)

**Files to migrate:**

- `platform/apps/api/src/reservations/availability.service.ts`
- `platform/apps/api/src/dynamic-pricing/pricing.service.ts`

**New Rust service:**

```
platform/services/availability-rs/
  src/
    main.rs
    availability.rs   # Date range checking
    pricing.rs        # Dynamic pricing calculation
    calendar.rs       # Calendar utilities
  Cargo.toml
```

**API contract:**

```rust
POST /check-availability
{
  "campground_id": 1,
  "site_class_id": 5,
  "arrival_date": "2025-06-15",
  "departure_date": "2025-06-20"
}

Response:
{
  "available": true,
  "sites": [101, 102, 105],
  "total_price_cents": 45000
}
```

---

### Priority 3: Authentication/Security 🟡 HIGH

**Why:** Security-critical, can't have vulnerabilities
**Risk if not done:** Account takeovers, data breaches
**Effort:** Medium (3-4 days)

**Files to migrate:**

- `platform/apps/api/src/auth/jwt.service.ts`
- `platform/apps/api/src/auth/password.service.ts`

**New Rust service:**

```
platform/services/auth-service-rs/
  src/
    main.rs
    jwt.rs            # JWT token creation/validation
    password.rs       # Password hashing (bcrypt/argon2)
    session.rs        # Session management
  Cargo.toml
```

**API contract:**

```rust
POST /auth/verify-token
{
  "token": "eyJhbGc..."
}

Response:
{
  "valid": true,
  "user_id": 123,
  "expires_at": 1704153600
}
```

---

### Priority 4: Math-Heavy Features 🟢 MEDIUM

**Why:** Calculations need to be exact
**Risk if not done:** Pricing errors, accounting issues
**Effort:** Low (1-2 days per feature)

**Candidates:**

- Tax calculations
- Discount calculations
- Revenue reporting aggregations
- Occupancy rate calculations

---

## Migration Strategy

### Phase 1: Setup (Do Now)

- [x] Add Rust to tech stack in CLAUDE.md
- [x] Create `.claude/rules/rust.md`
- [x] Add Rust build commands
- [x] Update `.claudeignore`
- [ ] Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### Phase 2: First Service (After first 10 customers)

**Start with:** Payment Processing (highest risk)

1. Create new Rust service alongside existing TypeScript
2. Implement same API contract
3. Run both in parallel (shadow mode)
4. Compare results for 1 week
5. Switch traffic to Rust service
6. Monitor for 1 week
7. Decommission TypeScript version

### Phase 3: Second Service (After 50 customers)

**Next:** Availability Calculator

Repeat same process as Phase 2.

### Phase 4: Third Service (After 100 customers)

**Next:** Authentication

Repeat same process as Phase 2.

### Phase 5: Remaining Features (Ongoing)

Migrate math-heavy features as needed.

---

## Before You Start

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version
cargo --version

# Install useful tools
cargo install cargo-watch  # Auto-rebuild on file changes
cargo install cargo-edit   # Easier dependency management
```

### Learning Resources

- [The Rust Book](https://doc.rust-lang.org/book/) - Official guide (Chapters 1-10)
- [Rustlings](https://github.com/rust-lang/rustlings) - Interactive exercises
- Ask Claude to explain Rust concepts as you go

### Testing Strategy

Every Rust service must have:

1. Unit tests (test each function)
2. Integration tests (test HTTP API)
3. Shadow mode deployment (run alongside TypeScript for 1 week)
4. Monitoring and alerting

---

## Success Metrics

**How to know migration is successful:**

- ✅ Zero runtime errors in Rust services (if it compiles, it works)
- ✅ 50% fewer bugs in migrated features
- ✅ Faster response times (2-10x improvement)
- ✅ Lower memory usage
- ✅ Easier to maintain (compiler catches mistakes)

---

## Rollback Plan

If Rust service has issues:

1. Switch traffic back to TypeScript immediately
2. Debug Rust service in isolation
3. Fix issues
4. Re-deploy to shadow mode
5. Try again

Keep TypeScript services for at least 1 month after Rust migration.

---

## Next Steps (When You're Ready)

**When you have your first customer:**

1. Review this plan
2. Pick Priority 1 (Payment Processing)
3. Tell Claude: "Let's migrate payment processing to Rust"
4. Claude will guide you through the process

**Remember:** Don't migrate until you have real users. Build fast in TypeScript first, then make it bulletproof with Rust.

---

## Questions to Ask Claude When Ready

- "Show me how to set up the payment-processor-rs service"
- "Write the Rust code for processing Stripe payments"
- "How do I deploy this Rust service to Railway?"
- "Write tests for the payment processor"
- "Help me run both services in parallel for testing"
