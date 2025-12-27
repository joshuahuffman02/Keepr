# Gamification System Data Flow

## Visual Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐          ┌──────────────────────────┐    │
│  │  Staff Dashboard     │          │  Admin Settings          │    │
│  │  /gamification       │          │  /settings/gamification  │    │
│  ├──────────────────────┤          ├──────────────────────────┤    │
│  │ • XP Balance        │          │ • Enable/Disable         │    │
│  │ • Level Progress    │          │ • Role Settings          │    │
│  │ • Leaderboard       │          │ • XP Rules               │    │
│  │ • Recent Events     │          │ • Manual Awards          │    │
│  │ • Activity Chart    │          │ • Leaderboard Preview    │    │
│  └──────────┬───────────┘          └──────────┬───────────────┘    │
│             │                                  │                     │
└─────────────┼──────────────────────────────────┼─────────────────────┘
              │                                  │
              │  React Query + Zod Validation    │
              │                                  │
┌─────────────┼──────────────────────────────────┼─────────────────────┐
│             ▼                                  ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              API Client (lib/api-client.ts)                 │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ • getGamificationDashboard(campgroundId)                    │   │
│  │ • getGamificationSettings(campgroundId)                     │   │
│  │ • updateGamificationSettings(payload)                       │   │
│  │ • getGamificationRules(campgroundId)                        │   │
│  │ • manualGamificationAward(payload)                          │   │
│  │ • getGamificationLeaderboard(campgroundId, days)            │   │
│  │ • getGamificationStats(campgroundId, days)                  │   │
│  └─────────────────────┬───────────────────────────────────────┘   │
│                        │                                            │
└────────────────────────┼────────────────────────────────────────────┘
                         │
                         │  HTTP/JSON (fetch)
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                     BACKEND API                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         GamificationController (NestJS)                      │  │
│  │         src/gamification/gamification.controller.ts          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  GET    /gamification/dashboard?campgroundId={id}            │  │
│  │  GET    /gamification/settings?campgroundId={id}             │  │
│  │  PATCH  /gamification/settings                               │  │
│  │  GET    /gamification/rules?campgroundId={id}                │  │
│  │  POST   /gamification/rules                                  │  │
│  │  POST   /gamification/award                                  │  │
│  │  GET    /gamification/levels                                 │  │
│  │  GET    /gamification/leaderboard?campgroundId={id}&days={n} │  │
│  │  GET    /gamification/stats?campgroundId={id}&days={n}       │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                            │
│                         │  Dependency Injection                      │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         GamificationService                                  │  │
│  │         src/gamification/gamification.service.ts             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ • getDashboard()        • getLeaderboard()                   │  │
│  │ • getSettings()         • getStats()                         │  │
│  │ • updateSettings()      • computeLevel()                     │  │
│  │ • getRules()            • recordEvent()                      │  │
│  │ • upsertRule()          • manualAward()                      │  │
│  │ • getLevels()           • assertManager()                    │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                            │
│                         │  Prisma ORM                                │
│                         ▼                                            │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          │  SQL Queries
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    PostgreSQL Database                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │ GamificationSetting  │  │  LevelDefinition     │                │
│  ├──────────────────────┤  ├──────────────────────┤                │
│  │ id                   │  │ id                   │                │
│  │ campgroundId (unique)│  │ level (unique)       │                │
│  │ enabled              │  │ name                 │                │
│  │ enabledRoles[]       │  │ minXp                │                │
│  │ createdAt            │  │ perks (JSON)         │                │
│  │ updatedAt            │  │ createdAt            │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │ XpBalance            │  │  XpEvent             │                │
│  ├──────────────────────┤  ├──────────────────────┤                │
│  │ id                   │  │ id                   │                │
│  │ campgroundId         │  │ campgroundId         │                │
│  │ userId               │  │ userId               │                │
│  │ totalXp              │  │ membershipId         │                │
│  │ currentLevel         │  │ category (enum)      │                │
│  │ lastEventAt          │  │ xp                   │                │
│  │ createdAt            │  │ reason               │                │
│  │ updatedAt            │  │ sourceType           │                │
│  │                      │  │ sourceId             │                │
│  │ @@unique([cgId,uid]) │  │ eventKey (unique)    │                │
│  └──────────────────────┘  │ metadata (JSON)      │                │
│                             │ occurredAt           │                │
│  ┌──────────────────────┐  │ createdAt            │                │
│  │ XpRule               │  └──────────────────────┘                │
│  ├──────────────────────┤                                           │
│  │ id                   │                                           │
│  │ campgroundId         │                                           │
│  │ category (enum)      │                                           │
│  │ minXp                │                                           │
│  │ maxXp                │                                           │
│  │ defaultXp            │                                           │
│  │ isActive             │                                           │
│  │ createdById          │                                           │
│  │ createdAt            │                                           │
│  │ updatedAt            │                                           │
│  │                      │                                           │
│  │ @@unique([cgId,cat]) │                                           │
│  └──────────────────────┘                                           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Request/Response Flow Example

### Example: Staff Views Dashboard

```
┌─────────┐
│ Browser │
└────┬────┘
     │ User clicks /gamification
     ▼
┌──────────────────────────────┐
│ page.tsx (React Component)   │
└────┬─────────────────────────┘
     │ useQuery({ queryFn: apiClient.getGamificationDashboard })
     ▼
┌──────────────────────────────┐
│ apiClient.ts                 │
│ fetch(GET /gamification/dashboard?campgroundId=abc123)
└────┬─────────────────────────┘
     │ HTTP Request
     ▼
┌──────────────────────────────┐
│ GamificationController       │
│ @Get("dashboard")            │
└────┬─────────────────────────┘
     │ this.gamificationService.getDashboard(userId, campgroundId)
     ▼
┌──────────────────────────────┐
│ GamificationService          │
│ getDashboard(userId, cgId)   │
└────┬─────────────────────────┘
     │ Promise.all([...])
     ├─► prisma.gamificationSetting.findUnique()
     ├─► prisma.campgroundMembership.findFirst()
     ├─► prisma.xpBalance.findUnique()
     ├─► prisma.xpEvent.findMany()
     └─► prisma.levelDefinition.findMany()
     │
     │ Results aggregated
     ▼
┌──────────────────────────────┐
│ PostgreSQL Database          │
│ • GamificationSetting        │
│ • CampgroundMembership       │
│ • XpBalance                  │
│ • XpEvent                    │
│ • LevelDefinition            │
└────┬─────────────────────────┘
     │ Data returned
     ▼
┌──────────────────────────────┐
│ GamificationService          │
│ • Computes level progress    │
│ • Checks permissions         │
│ • Formats response           │
└────┬─────────────────────────┘
     │ Returns JSON
     ▼
┌──────────────────────────────┐
│ GamificationController       │
│ Returns response to client   │
└────┬─────────────────────────┘
     │ HTTP Response
     ▼
┌──────────────────────────────┐
│ apiClient.ts                 │
│ • Parses JSON                │
│ • Validates with Zod         │
│ • Returns typed data         │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ page.tsx (React Component)   │
│ • React Query caches data    │
│ • Component re-renders       │
│ • UI displays XP, levels,    │
│   leaderboard, etc.          │
└──────────────────────────────┘
```

## Key Points

1. **No stub data in production**: The stub-data.ts file is NEVER imported by production code
2. **All data persists**: Every XP award, setting change, etc. is saved to PostgreSQL
3. **Type-safe end-to-end**: Prisma → NestJS DTOs → Zod schemas → TypeScript types
4. **Real-time updates**: React Query automatically refetches and invalidates cache
5. **Transaction safety**: XP awards use Prisma transactions to ensure consistency
6. **Permission checks**: Service layer validates user roles before mutations

## Testing the Connection

The easiest way to prove the connection works:

1. Award XP to yourself via `/dashboard/settings/gamification`
2. Note the XP amount
3. Navigate to `/gamification` and verify it appears
4. **Refresh the page** - if XP persists, it's in the database (not in-memory)
5. Check the database directly with Prisma Studio to see the records
