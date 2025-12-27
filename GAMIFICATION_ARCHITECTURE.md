# Gamification System Architecture

## Overview

The Campreserv gamification system is **fully connected to the backend database** and uses real-time data persistence. This document clarifies the architecture and dispels any confusion about stub data.

## Status: Production-Ready

- **Backend**: Fully implemented with Prisma ORM, NestJS service, and REST API
- **Frontend**: Connected to real API endpoints via `apiClient`
- **Database**: PostgreSQL with complete schema for XP, levels, badges, and challenges
- **Stub Data**: Only used for testing/storybook, NOT in production

---

## Architecture

### Backend (API)

**Location**: `platform/apps/api/src/gamification/`

#### Files:
- `gamification.controller.ts` - REST API endpoints
- `gamification.service.ts` - Business logic and database operations
- `gamification.module.ts` - NestJS module configuration
- `dto/gamification.dto.ts` - Data transfer objects for validation

#### API Endpoints:

```
GET    /gamification/dashboard?campgroundId={id}
GET    /gamification/settings?campgroundId={id}
PATCH  /gamification/settings
GET    /gamification/rules?campgroundId={id}
POST   /gamification/rules
POST   /gamification/award
GET    /gamification/levels
GET    /gamification/leaderboard?campgroundId={id}&days={n}
GET    /gamification/stats?campgroundId={id}&days={n}
```

#### Database Schema (Prisma):

```prisma
model GamificationSetting {
  id           String     @id @default(cuid())
  campgroundId String     @unique
  enabled      Boolean    @default(false)
  enabledRoles UserRole[] @default([])
  campground   Campground @relation(...)
}

model LevelDefinition {
  id        String   @id @default(cuid())
  level     Int      @unique
  name      String
  minXp     Int
  perks     Json?
}

model XpRule {
  id           String                    @id @default(cuid())
  campgroundId String
  category     GamificationEventCategory
  minXp        Int
  maxXp        Int
  defaultXp    Int
  isActive     Boolean
}

model XpBalance {
  id           String   @id @default(cuid())
  campgroundId String
  userId       String
  totalXp      Int      @default(0)
  currentLevel Int      @default(1)
  lastEventAt  DateTime?
  @@unique([campgroundId, userId])
}

model XpEvent {
  id           String                    @id @default(cuid())
  campgroundId String
  userId       String
  category     GamificationEventCategory
  xp           Int
  reason       String?
  sourceType   String?
  sourceId     String?
  eventKey     String?   @unique
  metadata     Json?
  occurredAt   DateTime
}
```

### Frontend (Web)

**Location**: `platform/apps/web/`

#### Pages:
- `app/gamification/page.tsx` - Staff dashboard showing XP, levels, leaderboard
- `app/dashboard/settings/gamification/page.tsx` - Admin settings and XP awards

#### API Client:

**Location**: `lib/api-client.ts`

```typescript
// All gamification endpoints use real API:
apiClient.getGamificationDashboard(campgroundId)
apiClient.getGamificationSettings(campgroundId)
apiClient.updateGamificationSettings(payload)
apiClient.getGamificationRules(campgroundId)
apiClient.upsertGamificationRule(payload)
apiClient.manualGamificationAward(payload)
apiClient.listGamificationLevels()
apiClient.getGamificationLeaderboard(campgroundId, days)
apiClient.getGamificationStats(campgroundId, days)
```

#### Data Flow:

```
User Action → React Query → apiClient → Backend API → Database
                    ↓
             Response → Zod Validation → State Update → UI Render
```

### Stub Data (Testing Only)

**Location**: `platform/apps/web/lib/gamification/stub-data.ts`

**Purpose**: Testing and Storybook components only

**NOT used in**:
- Production pages
- Real user sessions
- Any runtime application code

**Only used in**:
- `stub-data.test.ts` - Unit tests
- E2E test fixtures (potentially)
- Storybook stories (if they exist)

---

## Features Implemented

### Staff Dashboard (`/gamification`)
- ✅ Real-time XP balance from database
- ✅ Level progression with animated UI
- ✅ Weekly/Monthly/All-time leaderboards
- ✅ Recent activity feed
- ✅ XP breakdown by category (pie chart)
- ✅ Streak tracking
- ✅ Level-up modal with confetti
- ✅ XP toast notifications

### Admin Settings (`/dashboard/settings/gamification`)
- ✅ Enable/disable gamification per campground
- ✅ Role-based access control
- ✅ XP rule configuration (min/max/default per category)
- ✅ Manual merit XP awards
- ✅ Leaderboard preview
- ✅ Real-time stats (Total XP, Top Performer, etc.)

### Backend Features
- ✅ Event deduplication via `eventKey`
- ✅ XP validation (min/max enforcement)
- ✅ Level calculation and progression
- ✅ Transactional consistency
- ✅ Automatic rule initialization
- ✅ Role-based filtering
- ✅ Leaderboard aggregation
- ✅ Category statistics

---

## Data Flow Examples

### Example 1: Staff Viewing Dashboard

```
1. User navigates to /gamification
2. Page.tsx calls: apiClient.getGamificationDashboard(campgroundId)
3. API Client fetches: GET /gamification/dashboard?campgroundId=cg-123
4. Backend Controller → Service → Prisma
5. Database queries:
   - GamificationSetting (is enabled?)
   - CampgroundMembership (user's role)
   - XpBalance (total XP, level)
   - XpEvent (recent events)
   - LevelDefinition (levels)
6. Service computes level progress
7. Response returns to frontend
8. Zod validates response against GamificationDashboardSchema
9. React Query caches result
10. UI renders with real data
```

### Example 2: Manager Awarding XP

```
1. Manager selects staff member, enters XP amount
2. Calls: apiClient.manualGamificationAward({...})
3. API Client posts: POST /gamification/award
4. Backend validates user is manager
5. Service.recordEvent() in transaction:
   - Creates XpEvent record
   - Updates/creates XpBalance (increment totalXp)
   - Computes new level
   - Updates currentLevel in balance
6. Response includes event, balance, level info
7. Frontend invalidates queries
8. Dashboard auto-refreshes with new data
9. Confetti animation plays
```

---

## Common Misconceptions

### ❌ Myth: "Frontend uses stub data"
**Reality**: Frontend uses `apiClient` which calls real backend endpoints. Stub data is only in test files.

### ❌ Myth: "Data is lost on refresh"
**Reality**: All XP, events, and settings are persisted in PostgreSQL via Prisma.

### ❌ Myth: "Need to connect backend"
**Reality**: Backend is already connected and fully functional. Module is imported in `app.module.ts`.

---

## Testing

### E2E Tests
**Location**: `platform/apps/web/e2e/gamification-smoke.spec.ts`

Tests navigation, UI interactions, and form submissions.

### Unit Tests
**Location**: `platform/apps/api/src/gamification/gamification.service.spec.ts`

Tests service logic with mocked Prisma client.

---

## Troubleshooting

### Issue: "No data showing"
**Solution**: 
1. Verify campground is selected in UI
2. Check gamification is enabled: `/dashboard/settings/gamification`
3. Ensure user role is in `enabledRoles`
4. Check database has `GamificationSetting` record for campground

### Issue: "Leaderboard empty"
**Solution**:
1. Award some XP to staff members first
2. Verify XP events exist in database: `XpEvent` table
3. Check time window (weekly/monthly/all-time)

### Issue: "XP not updating"
**Solution**:
1. Check console for API errors
2. Verify backend is running
3. Check database connection
4. Ensure XP rules are active: `XpRule.isActive = true`

---

## Future Enhancements (Not Yet Implemented)

These features could be added:

- Badge system (models exist but UI incomplete)
- Challenge system (models exist but UI incomplete)
- Push notifications for level-ups
- Team challenges
- Seasonal resets
- Customizable level names per campground
- Advanced analytics dashboard

---

## Key Takeaway

**The gamification system is production-ready and fully connected to the backend.**

All data is persisted in PostgreSQL. The stub-data.ts file exists only for testing purposes and is not imported by any production code. The system uses React Query for data fetching, Zod for validation, and NestJS + Prisma for the backend.
