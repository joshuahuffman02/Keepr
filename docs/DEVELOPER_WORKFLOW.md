# Developer Workflow Guide

This document describes the development workflow, branching strategy, and deployment process for Keepr.

## Branch Strategy

```
feature/* ─────┐
               │  PR
               ▼
staging ───────────────┐
               ▲       │  PR
               │       ▼
               └── main (production)
```

### Branch Types

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production code | keeprstay.com / api.keeprstay.com |
| `staging` | Pre-production testing | staging.keeprstay.com / api-staging.keeprstay.com |
| `feature/*` | New features | Preview URLs (Vercel only) |
| `fix/*` | Bug fixes | Preview URLs (Vercel only) |

## Development Flow

### 1. Start New Work

```bash
# Ensure you're up to date
git checkout staging
git pull origin staging

# Create feature branch
git checkout -b feature/my-feature
```

### 2. Develop Locally

```bash
# Start local development
pnpm dev

# API runs at: http://localhost:4000
# Web runs at: http://localhost:3000
```

### 3. Commit Changes

```bash
# Stage and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push -u origin feature/my-feature
```

### 4. Create PR to Staging

1. Open GitHub and create a Pull Request
2. Target branch: `staging`
3. CI will automatically run:
   - Lint checks
   - API smoke tests
   - SDK tests
   - Build verification
   - E2E tests (on PRs)

### 5. Review and Merge to Staging

1. Get code review approval
2. Merge PR to `staging`
3. Automatic deployment triggers:
   - **Vercel**: Deploys to `staging.keeprstay.com`
   - **Railway**: Deploys to `api-staging.keeprstay.com`

### 6. Test on Staging

- Frontend: https://staging.keeprstay.com
- API: https://api-staging.keeprstay.com
- Verify feature works end-to-end
- Test with staging database (Supabase branch)

### 7. Promote to Production

```bash
# Create PR from staging to main
# Go to GitHub and create PR: staging → main
```

1. Create PR from `staging` to `main`
2. Final review
3. Merge to `main`
4. Production deployment triggers automatically

## CI/CD Pipeline

### GitHub Actions

The CI pipeline runs on all PRs to `main` or `staging`:

```yaml
Jobs:
  lint        → ESLint checks
  test-api    → API smoke tests with test database
  test-sdk    → SDK unit tests
  build       → Full build verification
  e2e         → Playwright E2E tests (PRs only)
```

### Deployment Targets

| Environment | Frontend | API | Database |
|-------------|----------|-----|----------|
| Production | Vercel (main) | Railway (production) | Supabase (main) |
| Staging | Vercel (staging) | Railway (staging) | Supabase (staging branch) |
| Preview | Vercel (auto) | N/A | N/A |

## Environment Variables

### Production (main branch)

```bash
# Frontend (Vercel)
NEXT_PUBLIC_API_BASE=https://api.keeprstay.com/api
AUTH_URL=https://keeprstay.com

# API (Railway)
PLATFORM_DATABASE_URL=<production-supabase-url>
ALLOWED_ORIGINS=https://keeprstay.com
```

### Staging (staging branch)

```bash
# Frontend (Vercel)
NEXT_PUBLIC_API_BASE=https://api-staging.keeprstay.com/api
AUTH_URL=https://staging.keeprstay.com

# API (Railway)
PLATFORM_DATABASE_URL=<staging-supabase-url>
ALLOWED_ORIGINS=https://staging.keeprstay.com
```

### Local Development

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_BASE=http://localhost:4000/api
AUTH_URL=http://localhost:3000

# API (.env)
PLATFORM_DATABASE_URL=<local-or-dev-database>
```

## Quick Commands

```bash
# Run full build (verify before committing)
pnpm build

# Run linting
pnpm lint:web

# Run API tests
pnpm --dir platform/apps/api test:smoke

# Run E2E tests locally
pnpm --dir platform/apps/web test:e2e

# Generate Prisma client after schema changes
pnpm --dir platform/apps/api prisma:generate

# Run database migrations
pnpm --dir platform/apps/api prisma:migrate
```

## Troubleshooting

### Build Failures

1. Run `pnpm build` locally first
2. Check CI logs for specific error
3. Ensure all environment variables are set

### Staging Not Updating

1. Check Vercel dashboard for deployment status
2. Check Railway dashboard for API deployment
3. Verify the commit is on `staging` branch

### Database Issues

1. Staging uses a separate Supabase branch
2. Run migrations on staging: Railway auto-runs on deploy
3. Check Supabase dashboard for branch status

## URLs Reference

| Environment | Frontend | API | Health Check |
|-------------|----------|-----|--------------|
| Production | https://keeprstay.com | https://api.keeprstay.com | /health |
| Staging | https://staging.keeprstay.com | https://api-staging.keeprstay.com | /health |
| Local | http://localhost:3000 | http://localhost:4000 | /health |

## Git Commit Conventions

Use conventional commits for clear history:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: improve code structure
test: add tests
chore: maintenance tasks
```

## Emergency Hotfix

For critical production issues:

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# Make fix, test locally
pnpm build

# Push and create PR directly to main
git push -u origin hotfix/critical-fix

# After merge, backport to staging
git checkout staging
git merge main
git push origin staging
```
