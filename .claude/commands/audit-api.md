---
description: Find frontend API calls that don't match backend expectations
---

# API Consistency Audit

Scan for mismatches between frontend API calls and backend endpoints.

## Process

1. **Find API client methods with optional parameters**:

   ```bash
   grep -n "async \w\+.*?:" apps/web/lib/api-client.ts
   ```

2. **For each method, find all call sites**:

   ```bash
   grep -rn "apiClient.methodName" --include="*.tsx" apps/web/
   ```

3. **Check for useState hooks that match parameter names but aren't wired**:
   Look for patterns like:

   ```typescript
   const [paymentMethod, setPaymentMethod] = useState("card");
   // ... component code ...
   apiClient.recordPayment(id, amount); // paymentMethod not passed!
   ```

4. **Cross-reference backend DTOs**:
   Check `apps/api/src/**/dto/*.dto.ts` to see what fields are expected

## Report Format

For each mismatch:

- **File**: `path:line`
- **Frontend call**: What's being sent
- **Backend expects**: What the DTO/endpoint expects
- **Missing**: What's not being passed
- **Impact**: What breaks because of this
