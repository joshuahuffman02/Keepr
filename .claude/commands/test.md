---
description: Run tests for API or Web
---

# Run Tests

Execute test suites for the project.

## Test Commands

$ARGUMENTS

### API Tests

**All API tests:**

```bash
pnpm test:api
```

**Smoke tests only (fast):**

```bash
pnpm --dir platform/apps/api test:smoke
```

**Specific test file:**

```bash
pnpm test:api:path platform/apps/api/src/__tests__/[test-file].spec.ts
```

**Watch mode:**

```bash
pnpm --dir platform/apps/api test:watch
```

**With coverage:**

```bash
pnpm --dir platform/apps/api test:cov
```

### Web Tests

**Unit tests (Vitest):**

```bash
pnpm --dir platform/apps/web test
```

**With UI:**

```bash
pnpm --dir platform/apps/web test:ui
```

**E2E tests (Playwright):**

```bash
pnpm --dir platform/apps/web test:e2e
```

### SDK Tests

```bash
pnpm ci:sdk
```

## Test File Locations

- API: `platform/apps/api/src/__tests__/`
- Web: `platform/apps/web/__tests__/` or co-located with components

## Writing Tests

### API Test Pattern

```typescript
describe("FeatureController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it("should do something", async () => {
    const response = await request(app.getHttpServer()).get("/endpoint").expect(200);
  });
});
```

### Web Test Pattern

```typescript
import { render, screen } from '@testing-library/react';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## CI Pipeline

Full CI check:

```bash
pnpm ci
```

This runs: lint -> smoke tests -> SDK tests -> build -> budgets -> e2e
