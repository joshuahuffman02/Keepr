---
name: railway-deploy
description: Railway deployment patterns for Campreserv. Use when deploying, debugging deployments, or managing Railway services.
allowed-tools: Read, Bash, Grep
---

# Railway Deployment for Campreserv

## Services

| Service | Type       | Port |
| ------- | ---------- | ---- |
| api     | NestJS     | 4000 |
| web     | Next.js    | 3000 |
| db      | PostgreSQL | 5432 |

## Common Commands

### Check Status

```bash
railway status
railway logs --service api
railway logs --service web
```

### Deploy

```bash
# Auto-deploy on git push, or manual:
railway up --service api
railway up --service web
```

### Environment Variables

```bash
railway variables --service api
railway variables --service web
```

### Database Access

```bash
railway connect postgres
```

## Deployment Checklist

1. **Pre-deploy**
   - [ ] `pnpm build` passes locally
   - [ ] No uncommitted changes
   - [ ] Migrations applied

2. **Deploy**
   - [ ] Push to main or run `railway up`
   - [ ] Monitor logs for errors

3. **Post-deploy**
   - [ ] Verify health endpoints
   - [ ] Test critical paths

## Troubleshooting

### Build Fails

- Check Node version matches (22.x)
- Verify pnpm version (7.33.6)
- Check for missing dependencies

### Migration Fails

```bash
# Check migration status
DATABASE_URL="..." npx prisma migrate status

# Apply pending migrations
DATABASE_URL="..." npx prisma migrate deploy

# Resolve stuck migration
DATABASE_URL="..." npx prisma migrate resolve --applied "migration_name"
```

### Service Won't Start

1. Check logs: `railway logs --service api`
2. Verify environment variables
3. Check PORT is set correctly
4. Verify DATABASE_URL format

### Memory Issues

- Increase service memory in Railway dashboard
- Check for memory leaks in Node.js

## Rollback

```bash
# List recent deployments
railway deployment list --service api

# Rollback to previous
railway rollback --service api
```

## Health Checks

API health endpoint: `GET /health`
Expected: `{ "status": "ok", "database": "connected" }`
