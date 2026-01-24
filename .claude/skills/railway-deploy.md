# Railway Deployment Skill

Use this skill when deploying, debugging deployments, or managing Railway services for Campreserv.

## Quick Reference

### Current Architecture

```
Railway Project: Campreserv
├── API Service (NestJS)
│   ├── Dockerfile: Dockerfile.api
│   ├── Config: railway.api.toml
│   ├── Port: 8080 (Railway injects PORT=8080)
│   └── Domain: api.keeprstay.com
│
└── Web Service (Next.js)
    ├── Dockerfile: Dockerfile.web
    ├── Config: railway.web.toml
    ├── Port: 3000
    └── Domain: keeprstay.com
```

### Critical Configuration Rules

1. **NEVER modify these without understanding the full chain:**
   - `Dockerfile.api` - Port must be 4000 internally, Railway injects PORT=8080
   - `Dockerfile.web` - Port must be 3000
   - `railway.api.toml` - dockerfilePath must match
   - `railway.web.toml` - dockerfilePath must match

2. **Railway Dashboard Settings:**
   - API: Config File = `/railway.api.toml`, Target Port = 8080
   - Web: Config File = `/railway.web.toml`, Target Port = 3000

## Common Issues & Solutions

### Build Stuck in Loop

**Symptoms:** Build keeps restarting, never completes

**Causes:**

1. Watch paths triggering on build output
2. Health check failing repeatedly
3. Memory exhaustion during build
4. Circular dependency in build

**Solutions:**

```toml
# railway.toml - Add watch paths to prevent loops
[build]
watchPatterns = ["platform/apps/web/**"]

# Exclude build outputs
# .dockerignore should contain:
# node_modules
# .next
# dist
# .turbo
```

### Docker Cache Issues

**Symptoms:** Builds not picking up changes, stale dependencies

**Solutions:**

```bash
# Force rebuild without cache (via Railway dashboard)
# Or use CI/CD with --no-cache flag

# In Dockerfile, bust cache selectively:
ARG CACHEBUST=1
COPY package.json ./
RUN npm ci
```

**Better approach - layer ordering:**

```dockerfile
# Copy package files first (cached unless they change)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Then copy source (invalidates only this layer)
COPY . .
RUN pnpm build
```

### "Application Failed to Respond" (502)

**Check:**

1. App listening on `0.0.0.0:$PORT` not `localhost`
2. Target port matches actual listening port
3. Health check path returns 200

```javascript
// Correct Next.js start
next start -p ${PORT:-3000} -H 0.0.0.0
```

### Build Memory Issues

**Solutions:**

```toml
# railway.toml
[build]
# Increase Node memory for build
nixpacksPlan = { phases = { build = { cmds = ["NODE_OPTIONS=--max-old-space-size=4096 npm run build"] } } }
```

Or in Dockerfile:

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build
```

### Private Networking Issues

**"ENOTFOUND \*.railway.internal"**

Private networking is NOT available during build. Only use at runtime.

```typescript
// WRONG - connecting during build/module init
const redis = new Redis(process.env.REDIS_URL);

// RIGHT - connect in startup function
async function bootstrap() {
  const redis = new Redis(process.env.REDIS_URL);
}
```

## Deployment Commands

```bash
# Check Railway CLI
railway --version

# Login
railway login

# Link to project
railway link

# Deploy from CLI (bypasses GitHub)
railway up

# View logs
railway logs
railway logs -b  # Build logs
railway logs -d  # Deploy logs

# Redeploy (rebuild from same commit)
railway redeploy

# Open dashboard
railway open

# Check variables
railway variables

# Connect to database
railway connect postgres
```

## Pre-Deployment Checklist

Before deploying:

- [ ] `pnpm build` passes locally
- [ ] Environment variables set in Railway
- [ ] `NEXT_PUBLIC_API_BASE` set for web builds
- [ ] Database migrations ready (pre-deploy command)
- [ ] Health check endpoint responding
- [ ] `.dockerignore` excludes node_modules, .next, dist

## Config File Reference

### railway.api.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.api"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on-failure"
```

### railway.web.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.web"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on-failure"
```

## Debugging Steps

1. **Check build logs:** `railway logs -b`
2. **Check deploy logs:** `railway logs -d`
3. **Check runtime logs:** `railway logs`
4. **Verify config:** Ensure dashboard Config File path matches your toml
5. **Verify ports:** Target Port must match what app actually listens on
6. **Check health:** Manually curl health endpoint after deploy

## Environment Variables

### Required for API

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_...
PORT=8080 (Railway provides this)
```

### Required for Web

```
NEXT_PUBLIC_API_BASE=https://api.keeprstay.com
NEXTAUTH_URL=https://keeprstay.com
NEXTAUTH_SECRET=...
```

## Performance Optimization

### Faster Deploys

1. Use multi-stage Dockerfiles
2. Order layers: dependencies → source → build
3. Use `.dockerignore` aggressively
4. Pre-build images in CI/CD

### Cost Optimization

1. Use private networking (zero egress)
2. Enable App Sleep for staging
3. Set resource limits
4. Set usage limits

## Rollback Procedure

1. Go to Railway dashboard
2. Find the service
3. Click on Deployments
4. Find last working deployment
5. Click "Rollback"

Or via CLI:

```bash
railway redeploy  # Rebuilds from same commit
```

## When to Escalate

Contact Railway support if:

- Builds stuck for >15 minutes
- Dashboard not reflecting config changes
- Mysterious 502s with correct config
- Database connection pool exhaustion
- Billing questions

Railway Discord: https://discord.gg/railway
