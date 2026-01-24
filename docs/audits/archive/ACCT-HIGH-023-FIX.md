# ACCT-HIGH-023: Org Billing Subscription Endpoints Bypass Org Access Validation - FIXED

## Severity

**HIGH** - Cross-organization billing manipulation vulnerability

## Vulnerability Description

The organization billing controller had two endpoints that accepted `periodId` parameters without validating that the billing period belonged to the organization specified in the URL path:

1. `POST /organizations/:organizationId/billing/periods/:periodId/finalize`
2. `POST /organizations/:organizationId/billing/periods/:periodId/paid`

### Attack Vector

A malicious platform admin could:

1. Discover a `periodId` from Organization A
2. Call the endpoint using Organization B's `organizationId` in the URL
3. Manipulate billing periods across organizations

Example attack:

```bash
# Attacker learns periodId "period-123" belongs to Org A
# But calls endpoint with Org B's ID
POST /organizations/org-b-id/billing/periods/period-123/finalize
Authorization: Bearer <platform_admin_token>

# System would finalize Org A's period without checking the mismatch
```

## Root Cause

The endpoints only validated:

- User had `platform_admin` role
- Period existed in database

They did NOT validate:

- Period belonged to the organization in the URL path
- User had access to the target organization (even though platform_admins technically have access to all orgs, the validation was missing)

## Fix Implementation

### File Modified

`/Users/josh/Documents/GitHub/Campreserv (broken) copy/platform/apps/api/src/org-billing/org-billing.controller.ts`

### Changes Made

1. **Added new validation method** `validatePeriodOwnership()`:

```typescript
/**
 * Validates that a billing period belongs to the specified organization.
 * This prevents cross-organization billing manipulation.
 */
private async validatePeriodOwnership(periodId: string, organizationId: string): Promise<void> {
  const period = await this.prisma.organizationBillingPeriod.findUnique({
    where: { id: periodId },
    select: { organizationId: true },
  });

  if (!period) {
    throw new ForbiddenException("Billing period not found");
  }

  if (period.organizationId !== organizationId) {
    throw new ForbiddenException(
      "Billing period does not belong to the specified organization"
    );
  }
}
```

2. **Updated `finalizePeriod()` endpoint**:

```typescript
@Post("periods/:periodId/finalize")
@Roles(PlatformRole.platform_admin)
async finalizePeriod(
  @Param("organizationId") organizationId: string,  // Added parameter
  @Param("periodId") periodId: string,
  @Req() req: any  // Added parameter
) {
  // NEW: Validate period ownership to prevent cross-org manipulation
  await this.validatePeriodOwnership(periodId, organizationId);

  // NEW: Even for platform admins, validate org access for audit trail
  await this.validateOrgAccess(organizationId, req.user);

  return this.billingService.finalizePeriod(periodId);
}
```

3. **Updated `markPeriodPaid()` endpoint**:

```typescript
@Post("periods/:periodId/paid")
@Roles(PlatformRole.platform_admin)
async markPeriodPaid(
  @Param("organizationId") organizationId: string,  // Added parameter
  @Param("periodId") periodId: string,
  @Body() body: { stripePaymentIntentId?: string },
  @Req() req: any  // Added parameter
) {
  // NEW: Validate period ownership to prevent cross-org manipulation
  await this.validatePeriodOwnership(periodId, organizationId);

  // NEW: Even for platform admins, validate org access for audit trail
  await this.validateOrgAccess(organizationId, req.user);

  return this.billingService.markPeriodPaid(periodId, body.stripePaymentIntentId);
}
```

## Security Improvements

1. **Period Ownership Validation**: Both endpoints now verify the `periodId` belongs to the `organizationId` in the URL path
2. **Organization Access Validation**: Even platform_admins are validated for organization access (for audit trail purposes)
3. **Defense in Depth**: Two layers of validation prevent cross-organization manipulation
4. **Clear Error Messages**: Specific ForbiddenException messages help with debugging while preventing information leakage

## Testing Verification

Build completed successfully:

```
Successfully compiled: 863 files with swc (339.24ms)
```

## Impact

- **Before Fix**: Platform admins could manipulate billing periods across organizations
- **After Fix**: Billing period operations are strictly scoped to the organization in the URL path
- **Breaking Changes**: None - endpoints maintain same URL structure, just add additional validation

## Recommendations

1. **Add integration tests** for cross-organization validation:
   - Test that finalizePeriod rejects mismatched org/period
   - Test that markPeriodPaid rejects mismatched org/period
   - Test that valid requests still work

2. **Consider adding audit logging** for all billing operations:
   - Log user ID, organization ID, period ID
   - Track all finalize and payment marking operations

3. **Review similar patterns** in codebase:
   - Check if other admin-only endpoints have similar vulnerabilities
   - Look for other places where resource IDs are accepted without ownership validation

## Related Security Patterns

This fix follows the principle of **parameter binding validation** - when an endpoint accepts multiple identifiers (organizationId and periodId), always validate their relationship before performing operations.

This pattern should be applied to all endpoints that accept:

- Parent resource ID in URL path
- Child resource ID in URL path or body
- Operations that modify or access the child resource

## Status

**FIXED** - Ready for testing and deployment
