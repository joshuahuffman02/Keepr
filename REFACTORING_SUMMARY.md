# Settings Pages Refactoring Summary

## Overview
Refactored 5 settings pages to remove hardcoded mock data and implement real API endpoints with proper loading states and empty states.

## Files Modified

### 1. `/platform/apps/web/app/dashboard/settings/central/store/discounts/page.tsx`
**Changes:**
- ✅ Removed `mockDiscounts` array (lines 39-84)
- ✅ Added `useQuery` hook for fetching discounts from API
- ✅ Added `useMutation` hook for deleting discounts
- ✅ Added `useCampground` hook for campground context
- ✅ Implemented loading states with `Loader2` spinner
- ✅ Empty state already exists in `SettingsTable` component
- ✅ API endpoint: `GET /api/campgrounds/{campgroundId}/discounts`
- ✅ Delete endpoint: `DELETE /api/discounts/{discountId}`

**Key Additions:**
- Import: `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- Import: `useCampground` from `@/contexts/CampgroundContext`
- Import: `Loader2` icon
- Added `fetchDiscounts()` and `deleteDiscount()` API functions
- Added loading checks for hydration and selected campground

---

### 2. `/platform/apps/web/app/dashboard/settings/central/pricing/taxes/page.tsx`
**Changes:**
- ✅ Removed `mockTaxRules` array (lines 46-74)
- ✅ Added `useQuery` hook for fetching tax rules from API
- ✅ Added `useMutation` hook for deleting tax rules
- ✅ Added `useCampground` hook for campground context
- ✅ Implemented loading states with `Loader2` spinner
- ✅ Added empty state for when no tax rules exist
- ✅ API endpoint: `GET /api/tax-rules/campground/{campgroundId}`
- ✅ Delete endpoint: `DELETE /api/tax-rules/{taxRuleId}`

**Key Additions:**
- Import: `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- Import: `useCampground` from `@/contexts/CampgroundContext`
- Import: `Loader2` icon
- Added `fetchTaxRules()` and `deleteTaxRule()` API functions
- Added custom empty state card with icon and CTA button
- Modified tax rules list to conditionally render empty state

---

### 3. `/platform/apps/web/app/dashboard/settings/central/system/check/page.tsx`
**Changes:**
- ✅ Removed `mockIssues` array (lines 34-80)
- ✅ Added `useQuery` hook for fetching system check issues from API
- ✅ Added `useCampground` hook for campground context
- ✅ Implemented loading states with `Loader2` spinner
- ✅ Updated refresh handler to use `refetch()` from query
- ✅ Empty state already exists in component (shows "All clear!" when no issues)
- ✅ API endpoint: `GET /api/campgrounds/{campgroundId}/system-check`

**Key Additions:**
- Import: `useQuery` from `@tanstack/react-query`
- Import: `useCampground` from `@/contexts/CampgroundContext`
- Added `fetchSystemIssues()` API function
- Modified `handleRefresh` to use query refetch instead of simulated delay

---

### 4. `/platform/apps/web/app/dashboard/settings/central/bookings/closures/page.tsx`
**Changes:**
- ✅ Removed `mockClosures` array (lines 90-124)
- ✅ Removed `mockSiteClasses` array (line 126)
- ✅ Removed `mockSites` array (line 127)
- ✅ Added `useQuery` hooks for fetching closures and site classes from API
- ✅ Added `useMutation` hook for deleting closures
- ✅ Added `useCampground` hook for campground context
- ✅ Implemented loading states with `Loader2` spinner
- ✅ Empty state already exists in `SettingsTable` component
- ✅ API endpoints:
  - `GET /api/campgrounds/{campgroundId}/closures`
  - `GET /api/campgrounds/{campgroundId}/site-classes`
  - `DELETE /api/closures/{closureId}`

**Key Additions:**
- Import: `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- Import: `useCampground` from `@/contexts/CampgroundContext`
- Import: `Loader2` icon
- Added `fetchClosures()`, `fetchSiteClasses()`, and `deleteClosure()` API functions
- Updated dialog to use fetched `siteClasses` data instead of mock data
- Added TODO comments for save and toggle mutations (to be implemented)

---

### 5. `/platform/apps/web/app/dashboard/settings/central/bookings/stay-rules/page.tsx`
**Changes:**
- ✅ Removed `mockRules` array (lines 46-80)
- ✅ Added `useQuery` hook for fetching stay rules from API
- ✅ Added `useMutation` hook for deleting stay rules
- ✅ Added `useCampground` hook for campground context
- ✅ Implemented loading states with `Loader2` spinner
- ✅ Added empty state for when no stay rules exist
- ✅ API endpoints:
  - `GET /api/campgrounds/{campgroundId}/stay-rules`
  - `DELETE /api/stay-rules/{ruleId}`

**Key Additions:**
- Import: `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- Import: `useCampground` from `@/contexts/CampgroundContext`
- Import: `Loader2` icon
- Added `fetchStayRules()` and `deleteStayRule()` API functions
- Added custom empty state card with icon and CTA button
- Modified rules list to conditionally render empty state

---

## Common Patterns Implemented

### 1. Data Fetching Pattern
```typescript
const { data: items = [], isLoading } = useQuery({
  queryKey: ["resource-name", selectedCampground?.id],
  queryFn: () => fetchResource(selectedCampground!.id),
  enabled: isHydrated && !!selectedCampground?.id,
});
```

### 2. Delete Mutation Pattern
```typescript
const deleteMutation = useMutation({
  mutationFn: deleteResource,
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ["resource-name", selectedCampground?.id] 
    });
  },
});
```

### 3. Loading States
```typescript
if (!isHydrated || !selectedCampground) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}

if (isLoading) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}
```

### 4. Empty States
Two approaches used:
- **SettingsTable component**: Built-in empty state via `emptyState` prop
- **Custom empty state**: Card with icon, message, and CTA button

---

## API Endpoints Required

The following API endpoints need to be implemented on the backend:

### Discounts
- `GET /api/campgrounds/{campgroundId}/discounts` - Fetch all discounts
- `DELETE /api/discounts/{discountId}` - Delete a discount

### Tax Rules
- `GET /api/tax-rules/campground/{campgroundId}` - Fetch all tax rules (✅ Already exists)
- `DELETE /api/tax-rules/{taxRuleId}` - Delete a tax rule (✅ Already exists)

### System Check
- `GET /api/campgrounds/{campgroundId}/system-check` - Fetch system issues

### Site Closures
- `GET /api/campgrounds/{campgroundId}/closures` - Fetch all closures
- `GET /api/campgrounds/{campgroundId}/site-classes` - Fetch site classes
- `DELETE /api/closures/{closureId}` - Delete a closure

### Stay Rules
- `GET /api/campgrounds/{campgroundId}/stay-rules` - Fetch all stay rules
- `DELETE /api/stay-rules/{ruleId}` - Delete a stay rule

---

## Testing Checklist

For each page, verify:
- [ ] Loading spinner shows while data is being fetched
- [ ] Loading spinner shows while waiting for campground context to hydrate
- [ ] Data displays correctly when API returns results
- [ ] Empty state displays when API returns empty array
- [ ] Delete functionality works and invalidates cache
- [ ] Error handling works when API request fails
- [ ] Campground switching triggers data refetch
- [ ] No console errors or warnings

---

## Future Enhancements

### Priority 1 (Required for full functionality):
1. Implement CREATE mutations for all resources
2. Implement UPDATE mutations for all resources
3. Implement TOGGLE (activate/deactivate) mutations where applicable
4. Add proper error toast notifications on API failures
5. Add success toast notifications on mutations

### Priority 2 (Nice to have):
1. Add optimistic updates for better UX
2. Implement search/filtering on the client side
3. Add pagination for large datasets
4. Add sorting capabilities
5. Implement bulk actions (delete multiple items)

---

## Notes

- All pages now properly use the `useCampground` hook for context
- All pages check for `isHydrated` before making API calls
- All API calls include `credentials: "include"` for authentication
- Delete mutations automatically invalidate queries to refresh data
- Loading states prevent flickering by checking both hydration and query loading
- Empty states provide clear CTAs for creating first items
