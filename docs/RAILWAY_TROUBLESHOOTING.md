# Railway Deployment Troubleshooting Guide

> **Last Updated**: January 2026
> **Context**: Keepr/Campreserv multi-service deployment on Railway

This document captures hard-won lessons from debugging Railway deployments. Reference this when things go wrong.

---

## Quick Reference: Current Working Configuration

### Dockerfile.web (CRITICAL)
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@7.33.6 --activate
WORKDIR /app
# ... build stages ...

# Production - MUST use pnpm exec, NOT absolute paths
WORKDIR /app/platform/apps/web
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
```

### Why `pnpm exec` instead of absolute paths?

**pnpm does NOT hoist packages** like npm/yarn. Instead, it uses symlinks to a content-addressable store.

```bash
# This FAILS with pnpm:
CMD ["node", "/app/node_modules/next/dist/bin/next", "start"]
# Error: Cannot find module '/app/node_modules/next/dist/bin/next'

# This WORKS with pnpm:
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
```

### Railway Dashboard Settings

| Service | Target Port | Notes |
|---------|-------------|-------|
| Web | 3000 | Must bind to 0.0.0.0 for Railway to reach container |
| API | 8080 | Railway injects PORT=8080 |

---

## Common Issues & Solutions

### Issue 1: "Cannot find module" Runtime Error

**Symptoms:**
- Build succeeds ("Deployment successful")
- Site shows 502 Bad Gateway
- Deploy Logs show: `Error: Cannot find module '/app/node_modules/...'`

**Root Cause:**
Using absolute paths in Dockerfile CMD with pnpm. pnpm doesn't hoist packages to `node_modules` like npm/yarn.

**Solution:**
```dockerfile
# WRONG - absolute path fails with pnpm
CMD ["node", "node_modules/next/dist/bin/next", "start"]

# CORRECT - pnpm exec resolves the binary properly
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
```

**Prevention:**
Always use `pnpm exec <binary>` or `pnpm run <script>` in pnpm-based Dockerfiles.

---

### Issue 2: Infinite Build Loop

**Symptoms:**
- Builds complete in seconds (using cache)
- Immediately restart again
- Status shows "Building" for hours
- Timer keeps incrementing (00:30, 00:31, etc.)

**Root Cause:**
Watch Paths includes a file that doesn't exist in the repo. Railway detects this as a "change" and triggers a new build, creating an infinite loop.

**Example:** Watch Paths included `/railway.web.toml` but the file was deleted from the repo.

**Solution:**
1. Go to Railway Dashboard → Service → Settings
2. Scroll to "Build" section → "Watch Paths"
3. Remove any paths for files that don't exist
4. Click the checkmark to save (not the X - that cancels!)

**Current Working Watch Paths for Web:**
```
/platform/apps/web/**
/platform/packages/shared/**
/Dockerfile.web
```

**Prevention:**
When deleting config files from the repo, also remove them from Watch Paths in Railway.

---

### Issue 3: New Deployment Stuck "Waiting for build..."

**Symptoms:**
- New deployment shows "Initializing"
- Build Logs show "Waiting for build to start..."
- Old deployments still showing "Building"

**Root Cause:**
Railway has limited build capacity. An old stuck/looping build is consuming the build slot.

**Solution:**
1. Go to Deployments tab
2. Find the old stuck BUILDING deployment
3. Click the ⋮ menu → Remove/Cancel
4. The new deployment should start building

**Prevention:**
Monitor deployments and cancel any that are stuck building for >15 minutes.

---

### Issue 4: 502 Bad Gateway with "Deployment Successful"

**Symptoms:**
- Railway shows green "Deployment successful"
- Site returns 502 Bad Gateway
- Everything looks fine in Railway dashboard

**Root Cause:**
"Deployment successful" means the BUILD succeeded. The RUNTIME can still crash.

**Solution:**
1. Check **Deploy Logs** (not Build Logs!) for the ACTIVE deployment
2. Look for runtime errors like "Cannot find module"
3. Fix the Dockerfile CMD and redeploy

**Key Insight:**
- **Build Logs** = Docker build output (compile time)
- **Deploy Logs** = Container runtime output (actual errors!)

---

## Railway UI Tips

### Watch Paths Field Behavior
- Click on an entry to edit it
- `X` button = Cancel/discard changes
- `✓` (checkmark) button = Save changes
- Trash icon = Delete entry (hover to reveal)

### Finding the Delete Button
```
Use browser automation to find: "Remove pattern" button
Or hover over the watch path entry to reveal trash icon
```

### Blue-Green Deployment
Railway uses blue-green deployment:
- The ACTIVE deployment continues serving traffic while new builds run
- A failed build won't take down the site
- But it also means the old broken deployment keeps serving 502s until a new one succeeds

---

## Debugging Checklist

When deployment fails, check in this order:

1. **Deploy Logs of ACTIVE deployment**
   - Runtime errors appear here, not in Build Logs
   - Look for "Cannot find module", port binding errors, etc.

2. **Build status**
   - Is it actually building or stuck in a loop?
   - If timer keeps resetting, check Watch Paths

3. **Watch Paths (Settings → Build)**
   - Remove any paths for deleted files
   - Common culprit: deleted config files

4. **Environment Variables**
   - `NEXT_PUBLIC_API_BASE` must exist for web builds
   - Check Variables tab in Railway

5. **Dockerfile CMD**
   - For pnpm: use `pnpm exec <binary>`
   - Must bind to `0.0.0.0` (not localhost)

---

## Timeline of Jan 2026 Deployment Fix

For historical reference, here's what was fixed:

| Issue | Symptom | Fix |
|-------|---------|-----|
| Dockerfile CMD | `Cannot find module '/app/node_modules/next/...'` | Changed to `pnpm exec next start` |
| Watch Paths | Build loop (builds complete instantly, restart) | Removed `/railway.web.toml` from Watch Paths |
| Build Queue | New deployment stuck "Waiting..." | Cancelled old stuck build |

**Time to resolve:** ~1 hour of debugging
**Root causes:** pnpm package hoisting behavior + Watch Paths ghost file

---

## Prevention Checklist

When modifying Railway/Docker configuration:

- [ ] If using pnpm, use `pnpm exec` or `pnpm run` - never absolute paths
- [ ] When deleting config files, also update Watch Paths
- [ ] After pushing, verify build starts AND completes within ~5-10 minutes
- [ ] If build loops, immediately check Watch Paths for deleted files
- [ ] Always check Deploy Logs (not just Build Logs) for runtime errors

---

## Related Files

| File | Purpose |
|------|---------|
| `Dockerfile.web` | Web service Docker build |
| `Dockerfile.api` | API service Docker build |
| `railway.toml` | Root Railway configuration |
| `CLAUDE.md` | Quick reference for Claude Code |

---

## External Resources

- [Railway Docs: Watch Paths](https://docs.railway.app/develop/builds#watch-paths)
- [pnpm FAQ: Flat node_modules](https://pnpm.io/faq#pnpm-does-not-work-with-your-project)
- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
