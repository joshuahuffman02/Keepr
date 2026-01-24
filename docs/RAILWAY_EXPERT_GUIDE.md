# Railway Expert Knowledge Guide

> Comprehensive reference for Railway deployment platform. Last updated: January 2026.

## Table of Contents

- [Platform Overview](#platform-overview)
- [Architecture & Core Concepts](#architecture--core-concepts)
- [Build Systems](#build-systems)
- [Networking](#networking)
- [Variables & Configuration](#variables--configuration)
- [Databases & Storage](#databases--storage)
- [Scaling & Performance](#scaling--performance)
- [CLI Reference](#cli-reference)
- [Environments & PR Deployments](#environments--pr-deployments)
- [Healthchecks & Restart Policies](#healthchecks--restart-policies)
- [Cron Jobs](#cron-jobs)
- [Cost Management](#cost-management)
- [Production Readiness Checklist](#production-readiness-checklist)
- [Compliance & Enterprise](#compliance--enterprise)
- [API & Automation](#api--automation)
- [Common Errors & Solutions](#common-errors--solutions)
- [Regions](#regions)
- [Key Tips for Production](#key-tips-for-production)

---

## Platform Overview

Railway is a deployment platform designed to streamline the software development lifecycle, combining instant deployments with infrastructure automation. It converts code repositories (with or without Dockerfiles) into OCI-compliant container images and deploys them automatically.

**Philosophy:** "Take what you need, leave what you don't" - flexibility without vendor lock-in.

**Key Differentiators:**

- Zero-config deployments with sane defaults
- Automatic private networking between services
- Built-in CI/CD from GitHub
- Usage-based pricing with included credits
- Config-as-code support

---

## Architecture & Core Concepts

### Hierarchy

```
Dashboard → Projects → Services → Deployments
                ↓
           Environments (staging, production, PR)
                ↓
      Volumes | Networking | Variables
```

### Projects

- Container for composing infrastructure
- Include automatic private networking between services
- Support multiple environments (staging/production/PR)
- Can be transferred between workspaces
- All related services should be in ONE project for private networking benefits

### Services

Deployment targets accepting:

- **GitHub repositories** - Auto-deploy on push
- **Docker images** - From Docker Hub, GHCR, GitLab, Quay.io
- **Local directories** - Via CLI (`railway up`)

Each service includes:

- Configuration management via service variables
- Backup capabilities for attached volumes
- CPU/memory/network metrics
- Customizable build and start commands
- Networking configuration

### Deployments

Lifecycle states:

```
Initializing → Building → Deploying → Active
                                   ↘ Failed/Crashed/Completed
```

**Key configuration variables:**

- `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` - Overlap between old/new deployments
- `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` - Graceful shutdown window (default: 3s)

### Environments

- Isolated configurations for different deployment stages
- PR environments auto-created/deleted with pull requests
- Variables can differ per environment
- Sync feature to transfer services between environments

---

## Build Systems

### Railpack (Current Default)

Zero-configuration builder that automatically:

1. Analyzes source code to detect language/framework
2. Installs appropriate runtime and dependencies
3. Builds application using detected/configured commands
4. Packages into optimized container image

**Supported Languages (11):**
Node, Python, Go, PHP, Java, Ruby, Rust, Elixir, Deno, Shell, Staticfile

### Nixpacks (Deprecated)

Legacy builder with 24+ language support including:

- JavaScript ecosystem (Node, Bun, Deno)
- Backend (Python, Ruby, Go, Java, PHP, Elixir)
- Compiled (Rust, C#/.NET, Haskell, Swift, Scala)
- Others (Crystal, Dart, Cobol, Zig)

Existing services continue working but migration to Railpack recommended.

### Custom Dockerfiles

- Auto-detected at repo root (logs: "Using detected Dockerfile!")
- Custom paths: `RAILWAY_DOCKERFILE_PATH=Dockerfile.prod`
- Build args declared with `ARG` directive
- Cache mounts supported: `--mount=type=cache,id=s/<service-id>-<path>,target=<path>`

**Performance Comparison:**

| Method            | Build Time | Deploy Time | Total |
| ----------------- | ---------- | ----------- | ----- |
| Nixpacks/Railpack | ~55s       | ~32s        | ~90s  |
| Custom Dockerfile | ~11s       | ~4s         | ~15s  |
| Pre-built Image   | 0s         | ~6s         | ~6s   |

### Dockerfile Optimization

```dockerfile
# Use minimal base images
FROM node:20-alpine AS builder

# Multi-stage builds
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["node", "dist/main.js"]
```

**Tips:**

- Use Alpine/slim variants
- Multi-stage builds to exclude dev dependencies
- Combine RUN commands to reduce layers
- Use `.dockerignore` to exclude unnecessary files

---

## Networking

### Private Networking

WireGuard mesh isolated to project+environment.

**DNS:** `[service-name].railway.internal`

**IP Support:**

- New environments (after Oct 2025): IPv4 + IPv6
- Legacy environments: IPv6 only

**Configuration:**

```javascript
// Node/Express - bind to all interfaces
app.listen(port, "::", () => console.log("Listening"));

// Or use 0.0.0.0 for IPv4 compatibility
app.listen(port, "0.0.0.0", () => console.log("Listening"));
```

**Framework-specific binding:**

- **Python/Gunicorn:** `--bind [::]:${PORT-3000}`
- **Rust/Axum:** `bind("[::]:8080")`
- **ioredis:** Add `family=0` parameter
- **bullmq:** Set `family: 0` in connection
- **MongoDB:** `--ipv6 --bind_ip ::,0.0.0.0`

**Benefits:**

- Zero egress costs for service-to-service
- Faster communication
- Not accessible from public internet
- Increased security

**Limitations:**

- Unavailable during build phase
- Client-side browser requests cannot access
- Cannot connect across projects/environments

### Public Networking

**Port Configuration:**

- Listen on `0.0.0.0:$PORT`
- Railway provides PORT automatically if not set
- Or manually set PORT variable

**Domains:**

- Not auto-generated; request via service panel
- Railway domains: `*.up.railway.app`
- Custom domains: CNAME to Railway domain

**Domain Limits:**

| Plan  | Custom Domains   |
| ----- | ---------------- |
| Trial | 1                |
| Hobby | 2                |
| Pro   | 20+ (expandable) |

**SSL/TLS:**

- Let's Encrypt certificates auto-generated
- External certificates not supported
- For Cloudflare: Use "Full" mode, NOT "Full (Strict)"

**Wildcard Domains:**

- Supported for flexible subdomain management
- CNAME for `authorize.railwaydns.net` must not be proxied
- Nested wildcards not supported

### TCP Proxy

For non-HTTP services (databases, custom protocols):

- Generates `domain:port` combination
- Random load balancing across replicas
- Incurs network egress charges

```bash
# Access database externally via TCP proxy
psql postgres://user:pass@containers-us-west-xxx.railway.app:7890/db
```

---

## Variables & Configuration

### Variable Types

1. **Service Variables** - Scoped to individual service
2. **Shared Variables** - Project-wide, referenced as `${{ shared.KEY }}`
3. **Reference Variables** - Cross-service: `${{ ServiceName.VAR }}`
4. **Sealed Variables** - Never visible in UI, no API retrieval, cannot be unsealed

### Reference Variable Syntax

```bash
# Reference another service's variable
DATABASE_URL=${{ Postgres.DATABASE_URL }}

# Reference shared variable
API_KEY=${{ shared.STRIPE_KEY }}

# Reference same service variable
FULL_URL=https://${{ RAILWAY_PUBLIC_DOMAIN }}
```

### Railway-Provided Variables

| Variable                    | Description                              |
| --------------------------- | ---------------------------------------- |
| `PORT`                      | Auto-assigned port (if not manually set) |
| `RAILWAY_PUBLIC_DOMAIN`     | Public domain (if configured)            |
| `RAILWAY_PRIVATE_DOMAIN`    | Private DNS name                         |
| `RAILWAY_TCP_PROXY_PORT`    | TCP proxy port                           |
| `RAILWAY_VOLUME_NAME`       | Attached volume name                     |
| `RAILWAY_VOLUME_MOUNT_PATH` | Volume mount location                    |
| `RAILWAY_SERVICE_NAME`      | Service name                             |
| `RAILWAY_ENVIRONMENT`       | Current environment                      |

### Config as Code

**railway.toml:**

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.prod"
buildCommand = "npm run build"

[deploy]
preDeployCommand = ["npm run db:migrate"]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

**railway.json:**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.prod"
  },
  "deploy": {
    "preDeployCommand": ["npm run db:migrate"],
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Custom config path:** Set in service settings (absolute path like `/backend/railway.toml`)

**Important:** Config in code ALWAYS overrides dashboard values.

---

## Databases & Storage

### Supported Databases

| Database   | Template | Notes                           |
| ---------- | -------- | ------------------------------- |
| PostgreSQL | Official | Extensions available separately |
| MySQL      | Official | -                               |
| MongoDB    | Official | -                               |
| Redis      | Official | -                               |

All databases are **unmanaged** - you control optimization and maintenance.

### PostgreSQL Configuration

```sql
-- Tune for your workload
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '64MB';
SELECT pg_reload_conf();
-- Restart deployment for changes to take effect
```

**SHM Issues:** Set `RAILWAY_SHM_SIZE_BYTES=268435456` (256MB)

**Extensions:** Install via separate templates:

- TimescaleDB
- PostGIS
- pgvector
- Combined bundles

### Connection Strings

**Internal (private network):**

```bash
DATABASE_URL=postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE
# Or use RAILWAY_PRIVATE_DOMAIN
DATABASE_URL=postgresql://user:pass@postgres.railway.internal:5432/railway
```

**External (TCP proxy):**

```bash
DATABASE_PUBLIC_URL=postgresql://user:pass@containers-us-west-xxx.railway.app:7890/railway
# Incurs egress charges!
```

### Volumes

- Persistent storage across deployments
- Mount during container startup (NOT build time)
- Pre-deploy commands CANNOT access volumes

**Configuration:**

```bash
RAILWAY_VOLUME_MOUNT_PATH=/app/data  # Where to mount
RAILWAY_RUN_UID=0  # For non-root container access
```

**Limitations:**

- Changes during build don't persist
- Must use start command for persistent operations
- Region changes require volume migration (minimal downtime)

**Backups:**

- Incremental, copy-on-write
- Manual and automated options
- Charged only for exclusive data

### Storage Buckets

S3-compatible object storage:

**Pricing:**

- Storage: $0.015/GB-month
- Operations: Free
- Bucket egress: Free
- Service egress: Standard rates

**Supported Operations:**

- Put, Get, Head, Delete objects
- List objects (v1, v2)
- Copy objects
- Presigned URLs (up to 90 days)
- Multipart uploads

**Not Supported:**

- Server-side encryption
- Versioning
- Object locks
- Lifecycle configuration
- Public buckets

---

## Scaling & Performance

### Vertical Autoscaling

Automatic scaling up to plan limits:

| Plan       | RAM    | vCPU | Volume  | Image Size |
| ---------- | ------ | ---- | ------- | ---------- |
| Trial      | 1 GB   | 2    | 0.5 GB  | 4 GB       |
| Free       | 0.5 GB | 1    | 0.5 GB  | 4 GB       |
| Hobby      | 8 GB   | 8    | 5 GB    | 100 GB     |
| Pro        | 32 GB  | 32   | 50 GB\* | Unlimited  |
| Enterprise | 48 GB  | 64   | 2 TB\*  | Unlimited  |

\*Self-serve increases up to 250GB for Pro/Enterprise

### Horizontal Scaling

- Manual replica configuration in service settings
- Each replica gets FULL resource allocation
- 2 replicas on Pro = potential 64 vCPU, 64 GB RAM combined

**Multi-Region Replicas:**

- Distribute across different regions
- Traffic routes to nearest region first
- Random distribution within region

**Load Balancing:**

- Random distribution (no sticky sessions yet)
- Public traffic → nearest region → random replica

### App Sleep (Serverless)

Reduces costs for inactive services:

**How it works:**

- Service sleeps after 10 min without OUTBOUND traffic
- Wakes on incoming requests (cold start delay)
- Open DB connections prevent sleep

**Factors preventing sleep:**

- Database connections
- Telemetry/logging
- Service-to-service communication
- Any inbound traffic

---

## CLI Reference

### Installation

```bash
# Homebrew (macOS)
brew install railway

# npm (requires Node 16+)
npm i -g @railway/cli

# Shell script (macOS, Linux, WSL)
bash <(curl -fsSL cli.new)

# Scoop (Windows)
scoop install railway
```

### Authentication

```bash
# Browser-based login
railway login

# Headless/SSH environments
railway login --browserless

# CI/CD with tokens
export RAILWAY_TOKEN=xxx        # Project-scoped
export RAILWAY_API_TOKEN=xxx    # Account-scoped
```

### Essential Commands

```bash
# Project Management
railway init                    # Create new project
railway link                    # Link directory to project
railway status                  # Current project info
railway open                    # Open dashboard

# Deployment
railway up [PATH]               # Deploy directory
railway up --detach             # Deploy without log streaming
railway redeploy                # Rebuild latest
railway down                    # Remove latest deployment

# Services & Databases
railway add                     # Add service/database
railway service                 # Link to specific service
railway connect [service]       # Open database shell (psql, redis-cli, etc.)

# Variables
railway variables               # List variables
railway variables --set "KEY=VALUE"
railway run <command>           # Execute with env vars injected
railway shell                   # Shell with env vars

# Environments
railway environment             # Switch environment
railway environment new [name]  # Create environment

# Domains
railway domain                  # Generate Railway domain
railway domain example.com      # Add custom domain

# Logs & SSH
railway logs                    # View logs
railway logs -b                 # Build logs
railway logs -d                 # Deploy logs
railway ssh                     # SSH into service

# Volumes
railway volume list
railway volume add
railway volume attach
railway volume detach
```

### CI/CD Tokens

| Token Type          | Scope          | Use Case                                 |
| ------------------- | -------------- | ---------------------------------------- |
| `RAILWAY_TOKEN`     | Single project | Deploy, logs, redeploy                   |
| `RAILWAY_API_TOKEN` | All workspaces | Create projects, manage across workspace |

---

## Environments & PR Deployments

### Environment Types

- **Production** - Main deployment
- **Staging** - Testing environment
- **PR Environments** - Auto-created for pull requests

### Creating Environments

**Duplicate:** Copies services, variables, and configuration (staged for review)
**Empty:** Start fresh

### PR Environment Features

Enable in Project Settings:

- Auto-provision when PR opens
- Auto-delete when PR merges/closes
- Bot PR support (Dependabot, Renovate)
- Railway domains only auto-provision if base env has them

**Security:** PRs from non-team members require GitHub account verification.

### Environment Syncing

Transfer services between environments:

1. Select source environment
2. Review changes (New, Edited, Removed)
3. Deploy staged changes

---

## Healthchecks & Restart Policies

### Healthchecks

- Called at deployment start only (NOT continuous monitoring)
- Must return HTTP 200 within timeout
- Default timeout: 300 seconds (5 minutes)
- Failed check = deployment marked as failed

**Configuration:**

```toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
```

**Best Practice:** Use [Uptime Kuma](https://railway.com/template/uptime-kuma) for continuous monitoring.

### Restart Policies

| Policy       | Behavior                       |
| ------------ | ------------------------------ |
| `never`      | No automatic restart           |
| `on-failure` | Restart on crash/non-zero exit |
| `always`     | Always restart                 |

```toml
[deploy]
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 5
```

### Pre-Deploy Commands

Execute between build and deploy:

```toml
[deploy]
preDeployCommand = ["npm run db:migrate", "npm run db:seed"]
```

**Characteristics:**

- Have private network access
- Have environment variables
- Run in separate container
- Must exit code 0 to proceed
- **CANNOT access volumes**
- **CANNOT persist filesystem changes**

---

## Cron Jobs

### Cron Syntax

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0=Sun)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

**Examples:**

```bash
0 * * * *      # Every hour
0 0 * * *      # Daily at midnight
0 0 * * 0      # Weekly on Sunday
*/15 * * * *   # Every 15 minutes
0 9 * * 1-5    # Weekdays at 9am
```

### Limitations

- **Minimum interval:** 5 minutes
- **Timezone:** UTC only
- **Overlap:** Skips if previous execution still running
- **Exit:** Service must exit cleanly after task

**Best For:** Short-lived tasks (backups, cleanup) that exit cleanly.

---

## Cost Management

### Pricing Model

| Plan       | Monthly Fee | Included Usage |
| ---------- | ----------- | -------------- |
| Free       | $0          | $1 credit      |
| Hobby      | $5          | $5 credit      |
| Pro        | $20         | $20 credit     |
| Enterprise | Custom      | Custom         |

### Resource Costs (Beyond Included)

| Resource       | Cost           |
| -------------- | -------------- |
| RAM            | $10/GB/month   |
| CPU            | $20/vCPU/month |
| Network Egress | $0.05/GB       |
| Volume Storage | $0.15/GB/month |

### Cost Optimization Strategies

1. **Use private networking** - Zero egress between services in same project
2. **Enable App Sleep** - For dev/staging environments
3. **Set usage limits** - Prevent surprise bills
4. **Resource limits** - Cap per-service maximums
5. **Optimize Docker images** - Smaller = faster = cheaper
6. **Use presigned URLs** - Zero egress for file downloads

### Usage Limits

**Soft Limit:** Email notification, services continue
**Hard Limit:** Services shut down at threshold

Notifications at: 75%, 90%, 100% of hard limit

```
Minimum hard limit: $10
Recovery: Manually increase/remove limit
```

---

## Production Readiness Checklist

### Performance & Reliability

- [ ] Deploy in nearest region to users
- [ ] Use private networking for inter-service communication
- [ ] Configure appropriate restart policies
- [ ] Run 2+ replicas for high availability
- [ ] Verify compute capacity matches plan limits
- [ ] Implement database replication for fault tolerance

### Observability & Monitoring

- [ ] Master the Log Explorer for multi-service queries
- [ ] Configure email/in-app deployment notifications
- [ ] Set up webhooks to Slack/Discord
- [ ] Implement external monitoring (Uptime Kuma, etc.)

### Quality Assurance

- [ ] Enable check suites (wait for GitHub CI)
- [ ] Maintain separate staging/production environments
- [ ] Enable PR environments for testing
- [ ] Use config-as-code for version control
- [ ] Document rollback procedures

### Security

- [ ] Keep internal services private (no public domain)
- [ ] Implement WAF/DDoS protection (Cloudflare)
- [ ] Use sealed variables for secrets
- [ ] Review service access permissions

### Disaster Recovery

- [ ] Enable automated volume backups
- [ ] Consider multi-region deployment
- [ ] Test backup restoration procedures
- [ ] Document incident response

---

## Compliance & Enterprise

### Certifications

| Certification | Availability         |
| ------------- | -------------------- |
| SOC 2 Type II | Available            |
| SOC 3         | Available            |
| HIPAA BAA     | With committed spend |
| GDPR          | DPA available        |

### Enterprise Features

- SSO integration
- Environment RBAC (restricted environments)
- Increased capacity limits
- Security audits

### Committed Spend Tiers

| Monthly Spend | Features Unlocked |
| ------------- | ----------------- |
| $1,000        | HIPAA compliance  |
| $2,000        | SLOs              |
| $10,000       | Dedicated hosts   |

---

## API & Automation

### GraphQL API

**Endpoint:** `https://backboard.railway.com/graphql/v2`
**Playground:** `https://railway.com/graphiql`

### Authentication Headers

```bash
# Team/Personal tokens
Authorization: Bearer <TOKEN>

# Project tokens
Project-Access-Token: <TOKEN>
```

### Rate Limits

| Plan       | Per Hour | Per Second |
| ---------- | -------- | ---------- |
| Free       | 100      | —          |
| Hobby      | 1,000    | 10         |
| Pro        | 10,000   | 50         |
| Enterprise | Custom   | Custom     |

**Response Headers:**

- `X-RateLimit-Limit` - Max requests
- `X-RateLimit-Remaining` - Requests left
- `X-RateLimit-Reset` - Reset timestamp
- `Retry-After` - Cooldown period

### MCP Server (AI Integration)

Natural language to Railway CLI operations:

- Works with Claude Desktop, Cursor, VS Code
- Destructive actions excluded by design
- Operations: create projects, deploy, manage vars, view logs

---

## Common Errors & Solutions

### "Application Failed to Respond" (502)

**Causes:**

1. Not binding to `0.0.0.0:$PORT`
2. Target port mismatch in domain settings
3. Service overloaded

**Solutions:**

```javascript
// Correct binding
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on port ${port}`);
});
```

### "No Start Command Could Be Found"

**Solution:** Add start command in service settings or config file:

```toml
[deploy]
startCommand = "npm start"
```

### "ENOTFOUND redis.railway.internal"

**Cause:** Private networking unavailable during build phase.

**Solution:** Ensure connections happen at runtime, not build:

```javascript
// Don't connect during module initialization
// Connect in startup function instead
```

### "Nixpacks Unable to Generate Build Plan"

**Solutions:**

1. Verify language detection (check for package.json, requirements.txt, etc.)
2. Use custom Dockerfile
3. Specify builder explicitly in config

### Build Memory Issues

**Solution:** Set `RAILWAY_SHM_SIZE_BYTES` for larger shared memory.

---

## Regions

| Region               | Location   | Identifier               |
| -------------------- | ---------- | ------------------------ |
| US West Metal        | California | `us-west2`               |
| US East Metal        | Virginia   | `us-east4-eqdc4a`        |
| EU West Metal        | Amsterdam  | `europe-west4-drams3a`   |
| Southeast Asia Metal | Singapore  | `asia-southeast1-eqsg3a` |

**Notes:**

- All users have access to Metal regions
- Pro plan required for some additional regions
- Volume migrations require minimal downtime
- Domain and private networking unaffected by region change

---

## Key Tips for Production

1. **Use custom Dockerfiles** - 15s deploys vs 90s with auto-builders
2. **Reference variables** - Never hardcode domains or connection strings
3. **Group services in one project** - Private networking benefits
4. **Set usage limits** - Prevent surprise bills
5. **Enable backups** - Before you need them
6. **Configure healthchecks** - Zero-downtime deploys
7. **Use pre-deploy for migrations** - But remember no volume access
8. **Monitor metrics** - CPU/memory/disk/network
9. **Test with PR environments** - Before merging to production
10. **Keep services private** - Only expose what needs public access

---

## Campreserv-Specific Notes

For our deployment:

**API Service:**

- Uses `Dockerfile.api`
- Railway injects `PORT=8080`
- Target Port in dashboard: 8080
- Config file: `/railway.api.toml`

**Web Service:**

- Uses `Dockerfile.web`
- Exposes port 3000
- Target Port in dashboard: 3000
- Config file: `/railway.web.toml`

**Critical:** Never modify Docker ports or Railway config without understanding the full chain.

---

## References

- [Railway Documentation](https://docs.railway.com/)
- [Railway Blog](https://blog.railway.com/)
- [Railway Help Station](https://station.railway.com/)
- [Railway Status](https://status.railway.com/)
- [Railway GitHub](https://github.com/railwayapp)
