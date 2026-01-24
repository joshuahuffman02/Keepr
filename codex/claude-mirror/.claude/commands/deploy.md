---
description: Deploy to Railway with pre-flight checks
---

# Deploy to Railway

Run a deployment with validation checks.

## Pre-flight Checks

Before deploying, verify:

1. **Build passes locally**

   ```bash
   pnpm build
   ```

2. **No uncommitted changes**

   ```bash
   git status
   ```

3. **Prisma migrations are up to date**
   ```bash
   pnpm --dir platform/apps/api prisma migrate status
   ```

## Deployment Steps

$ARGUMENTS

If no specific target provided:

### Full Stack Deploy

1. Push to main branch (Railway auto-deploys)
2. Monitor deployment: `railway logs`
3. Verify API health: `curl https://[api-domain]/health`

### API Only

```bash
railway up --service api
```

### Web Only

```bash
railway up --service web
```

## Post-Deploy Verification

1. Check Railway dashboard for deployment status
2. Verify API endpoints responding
3. Test critical user flows in production

## Rollback

If issues found:

```bash
railway rollback --service [api|web]
```

## Common Issues

- **Migration failed**: Check DATABASE_URL is set correctly
- **Build timeout**: Increase Railway build timeout or optimize build
- **Health check failing**: Verify PORT environment variable
