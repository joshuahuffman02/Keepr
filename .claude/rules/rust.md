---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---

# Rust-Specific Rules

## Why Rust in This Project

Rust is used for **security-critical and performance-critical** code where correctness is essential:

- Payment processing (can't afford bugs)
- Availability calculator (complex date logic)
- Authentication/security (critical)
- Math-heavy features (pricing calculations)

**Key principle:** If it compiles in Rust, it's ~correct. Perfect for AI-assisted development.

## Project Structure

```
platform/
  services/
    payment-processor-rs/    # Rust: Payment processing
    availability-rs/         # Rust: Availability calculator
    auth-service-rs/         # Rust: Authentication
  apps/
    api/                     # NestJS: Business logic, CRUD
    web/                     # Next.js: Frontend
```

## Code Patterns

### 1. Error Handling (CRITICAL)

```rust
// ALWAYS use Result<T, E> for operations that can fail
fn process_payment(amount_cents: u32) -> Result<PaymentResult, PaymentError> {
    if amount_cents == 0 {
        return Err(PaymentError::InvalidAmount);
    }

    // Use ? operator for error propagation
    let charge = stripe_client.create_charge(amount_cents)?;

    Ok(PaymentResult { charge_id: charge.id })
}

// NEVER use unwrap() or expect() in production code
// WRONG: let value = some_option.unwrap();
// RIGHT: let value = some_option.ok_or(Error::NotFound)?;
```

### 2. Money Handling

```rust
// ALWAYS use u32 or u64 for money in cents (never f64)
struct Price {
    amount_cents: u32,  // $99.99 = 9999
    currency: Currency,
}

// NEVER use floating point for money
// WRONG: let price = 99.99;
// RIGHT: let price_cents: u32 = 9999;

// For calculations, use checked arithmetic
fn calculate_total(price_cents: u32, quantity: u32) -> Result<u32, Error> {
    price_cents
        .checked_mul(quantity)
        .ok_or(Error::Overflow)
}
```

### 3. String Handling

```rust
// Use &str for borrowed strings (most common)
fn validate_email(email: &str) -> bool {
    email.contains('@')
}

// Use String for owned strings
fn create_greeting(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Prefer borrowing over cloning
// GOOD: fn process(data: &str)
// AVOID: fn process(data: String) unless you need ownership
```

### 4. Database Integration

```rust
// Use sqlx for type-safe database queries
use sqlx::PgPool;

async fn get_reservation(pool: &PgPool, id: i32) -> Result<Reservation, Error> {
    let reservation = sqlx::query_as!(
        Reservation,
        "SELECT * FROM reservations WHERE id = $1",
        id
    )
    .fetch_one(pool)
    .await?;

    Ok(reservation)
}
```

### 5. HTTP API Pattern

```rust
// Use actix-web or axum for HTTP servers
use actix_web::{web, HttpResponse, Result};

#[post("/api/payments")]
async fn create_payment(
    payment: web::Json<PaymentRequest>
) -> Result<HttpResponse> {
    // Validate input
    if payment.amount_cents == 0 {
        return Ok(HttpResponse::BadRequest().json(
            ErrorResponse { error: "Invalid amount" }
        ));
    }

    // Process payment
    let result = process_payment(payment.amount_cents)?;

    Ok(HttpResponse::Ok().json(result))
}
```

### 6. Async/Await

```rust
// Use tokio for async runtime
#[tokio::main]
async fn main() {
    // Async operations
    let result = fetch_data().await;
}

// Prefer async for I/O operations
async fn fetch_user(id: i32) -> Result<User, Error> {
    let response = reqwest::get(&format!("https://api/users/{}", id))
        .await?
        .json()
        .await?;
    Ok(response)
}
```

### 7. Type Safety

```rust
// Use newtypes for domain concepts
struct CampgroundId(i32);
struct UserId(i32);
struct AmountCents(u32);

// This prevents mixing up IDs
fn get_campground(id: CampgroundId) -> Result<Campground, Error> {
    // Can't accidentally pass UserId here!
}

// Use enums for state machines
#[derive(Debug, Clone)]
enum ReservationStatus {
    Pending,
    Confirmed,
    CheckedIn,
    CheckedOut,
    Cancelled,
}
```

## Common Commands

```bash
# Create new Rust service
cargo init --name my_service

# Build (development)
cargo build

# Build (production, optimized)
cargo build --release

# Run
cargo run

# Test
cargo test

# Lint
cargo clippy

# Format code
cargo fmt

# Check without building (faster)
cargo check

# Update dependencies
cargo update
```

## Dependencies to Use

```toml
[dependencies]
# HTTP server
actix-web = "4"
# Async runtime
tokio = { version = "1", features = ["full"] }
# Database
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio"] }
# JSON serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
# Error handling
anyhow = "1"
thiserror = "1"
# HTTP client
reqwest = { version = "0.11", features = ["json"] }
# Environment variables
dotenvy = "0.15"
```

## Testing Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_total() {
        let result = calculate_total(1000, 5).unwrap();
        assert_eq!(result, 5000);
    }

    #[tokio::test]
    async fn test_fetch_user() {
        let user = fetch_user(1).await.unwrap();
        assert_eq!(user.id, 1);
    }
}
```

## What NOT to Do

- ❌ Never use `unwrap()` or `expect()` in production
- ❌ Never use floating point for money
- ❌ Never ignore compiler warnings
- ❌ Never use `unsafe` without team review
- ❌ Never clone unnecessarily (prefer borrowing)
- ❌ Never panic in library code (return Result instead)

## Integration with NestJS

```rust
// Rust service exposes HTTP API
// NestJS calls it like any other microservice

// In NestJS:
const response = await axios.post('http://localhost:8080/process-payment', {
  amount_cents: 9999,
  currency: 'USD'
});
```

## Verification

After editing Rust code:

1. `cargo check` - Fast type checking
2. `cargo clippy` - Lint for common mistakes
3. `cargo test` - Run tests
4. `cargo build --release` - Final build

If it compiles with no warnings, it's probably correct!
