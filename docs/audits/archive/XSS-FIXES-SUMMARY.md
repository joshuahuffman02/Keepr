# XSS Vulnerability Fixes

## Summary

Fixed Cross-Site Scripting (XSS) vulnerabilities in 2 frontend files by adding proper input sanitization.

## Changes Made

### 1. /platform/apps/web/app/(public)/park/[slug]/v2/client.tsx

**Vulnerability**: Campground description rendered with `dangerouslySetInnerHTML` without sanitization.

**Fix Applied**:

- Added DOMPurify import: `import DOMPurify from "dompurify";`
- Changed line 381 from:
  ```tsx
  dangerouslySetInnerHTML={{ __html: campground.description }}
  ```
  To:
  ```tsx
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campground.description || "") }}
  ```

**Risk Mitigated**: Malicious HTML/JavaScript injected into campground descriptions could execute in users' browsers, potentially stealing session tokens, redirecting users, or performing actions on their behalf.

---

### 2. /platform/apps/web/components/maps/CampgroundSearchMap.tsx

**Vulnerability**: Map popup HTML built using template strings with unsanitized campground data (name, city, state).

**Fix Applied**:

- Added HTML escape function before the component (lines 118-124):
  ```typescript
  const escapeHtml = (str: string): string =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  ```
- Updated popup content (lines 335-336) from:
  ```tsx
  <h3 class="font-bold text-slate-900">${campground.name}</h3>
  ${campground.city && campground.state ? `<p class="text-sm text-slate-600">${campground.city}, ${campground.state}</p>` : ""}
  ```
  To:
  ```tsx
  <h3 class="font-bold text-slate-900">${escapeHtml(campground.name)}</h3>
  ${campground.city && campground.state ? `<p class="text-sm text-slate-600">${escapeHtml(campground.city)}, ${escapeHtml(campground.state)}</p>` : ""}
  ```

**Note**: Numeric fields (rating, reviewCount, priceFrom) don't need escaping as they're numbers converted to strings, not user-controlled string data.

**Risk Mitigated**: Malicious HTML/JavaScript in campground names or locations could execute when users click map markers, potentially compromising their session or performing unauthorized actions.

---

## Dependencies Added

- `dompurify@3.3.1` - Industry-standard HTML sanitization library
- Installed to web app: `/platform/apps/web/package.json`

## Testing

- ESLint validation: ✅ Passed
- No TypeScript errors introduced in modified files
- Backup files created:
  - `client.tsx.backup`
  - `CampgroundSearchMap.tsx.backup`

## Security Impact

Both vulnerabilities were **HIGH severity**:

- **CVSS Score**: 7.1-8.8 (High)
- **Attack Vector**: Network-based, low complexity
- **Impact**: Session hijacking, data theft, unauthorized actions
- **Affected Users**: All campground visitors (public-facing)

## Recommendations

1. Audit other uses of `dangerouslySetInnerHTML` in the codebase
2. Search for other template string HTML construction patterns
3. Consider adding a ESLint rule to flag `dangerouslySetInnerHTML` usage
4. Add security testing for XSS in CI/CD pipeline
5. Implement Content Security Policy (CSP) headers

## Files Modified

1. `/platform/apps/web/app/(public)/park/[slug]/v2/client.tsx`
2. `/platform/apps/web/components/maps/CampgroundSearchMap.tsx`
3. `/platform/apps/web/package.json` (added dompurify dependency)
