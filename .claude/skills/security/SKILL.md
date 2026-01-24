---
name: security
description: Security best practices for web applications handling payments and user data. Use when implementing authentication, authorization, handling sensitive data, or reviewing code for security vulnerabilities.
allowed-tools: Read, Glob, Grep
---

# Security for Campreserv

## Sensitive Data Categories

### High Sensitivity

- Payment card data (handled by Stripe - never stored locally)
- User passwords (hashed with bcrypt)
- JWT tokens and secrets
- API keys

### Medium Sensitivity

- Guest personal information (name, email, phone)
- Reservation details
- Financial records

### Low Sensitivity

- Site configurations
- Public campground info

## Authentication

### JWT Implementation

```typescript
// Token structure
{
  id: string;       // User ID
  email: string;
  platformRole?: string;
  iat: number;      // Issued at
  exp: number;      // Expiration
}

// Always verify tokens on protected routes
@UseGuards(JwtAuthGuard)
```

### Password Requirements

- Minimum 8 characters
- Hash with bcrypt (cost factor 10+)
- Never log or expose passwords
- Rate limit login attempts

## Authorization

### Permission Model

```typescript
// Check user has permission before action
if (!user.allowed.reportsRead) {
  throw new ForbiddenException();
}

// Resource ownership check
if (reservation.campgroundId !== user.campgroundId) {
  throw new ForbiddenException();
}
```

### Common Guards

- `JwtAuthGuard` - Verify authenticated
- `RolesGuard` - Check platform role
- `PermissionsGuard` - Check specific permissions

## Input Validation

### Never Trust User Input

```typescript
// Always validate DTOs
@IsEmail()
email: string;

@IsString()
@MinLength(1)
@MaxLength(100)
name: string;

@IsInt()
@Min(1)
@Max(100)
quantity: number;
```

### SQL Injection Prevention

Prisma uses parameterized queries by default. NEVER use raw SQL with user input:

```typescript
// SAFE - Prisma parameterized
await prisma.user.findMany({ where: { email } });

// DANGEROUS - Raw query with interpolation
await prisma.$queryRaw`SELECT * FROM users WHERE email = '${email}'`; // NO!
```

### XSS Prevention

React auto-escapes by default. Avoid:

```tsx
// DANGEROUS
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// SAFE - React escapes automatically
<div>{userInput}</div>
```

## Payment Security

### Stripe Integration

- Never handle raw card data - use Stripe Elements
- Verify webhook signatures
- Use idempotency keys for charges
- Store only Stripe customer/payment IDs

```typescript
// Verify webhook signature
const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

## API Security

### Rate Limiting

```typescript
// Apply to sensitive endpoints
@Throttle(5, 60) // 5 requests per 60 seconds
@Post('auth/login')
```

### CORS Configuration

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(","),
  credentials: true,
});
```

### Sensitive Data in Responses

```typescript
// Exclude sensitive fields
const { password, ...safeUser } = user;
return safeUser;
```

## Common Vulnerabilities to Prevent

### OWASP Top 10

1. **Broken Access Control** - Always verify permissions
2. **Cryptographic Failures** - Use strong encryption, secure secrets
3. **Injection** - Parameterized queries, input validation
4. **Insecure Design** - Threat model sensitive features
5. **Security Misconfiguration** - Secure defaults, env separation
6. **Vulnerable Components** - Keep dependencies updated
7. **Authentication Failures** - Strong passwords, MFA, rate limiting
8. **Data Integrity Failures** - Verify signatures, use checksums
9. **Logging Failures** - Log security events, never log secrets
10. **SSRF** - Validate/whitelist external URLs

## Security Checklist

- [ ] Authentication required for sensitive endpoints
- [ ] Authorization checked for resource access
- [ ] Input validated and sanitized
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] Passwords properly hashed
- [ ] No secrets in code or logs
- [ ] Rate limiting on auth endpoints
- [ ] CORS properly configured
- [ ] Dependencies up to date
- [ ] Error messages don't leak info
