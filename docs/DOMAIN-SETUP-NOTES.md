# Domain Setup Notes - keeprstay.com

## Status: In Progress (as of Jan 2026)

### What Was Done

1. **Railway Custom Domains Added:**
   - `keeprstay.com` → Web app (target: `fjzwvoxb.up.railway.app`)
   - `www.keeprstay.com` → Web app (target: `o96rf6i3.up.railway.app`)
   - `api.keeprstay.com` → API (target: `t2rfve9o.up.railway.app`)

2. **Cloudflare DNS Configured:**
   - Domain added to existing Cloudflare account (same one with R2 storage)
   - Account ID: `0b240ba76571f281dc4c4f6b628dd2ea`
   - CNAME records added for @, www, and api subdomains
   - Waiting for nameserver propagation from GoDaddy

3. **Environment Variables Updated:**
   | Service | Variable | New Value |
   |---------|----------|-----------|
   | API | `FRONTEND_URL` | `https://keeprstay.com` |
   | Web | `AUTH_URL` | `https://keeprstay.com` |
   | Web | `NEXT_PUBLIC_API_BASE` | `https://api.keeprstay.com/api` |
   | Web | `NEXT_PUBLIC_SENTRY_DSN` | Fixed (was corrupted) |

4. **GoDaddy Nameservers:**
   - Changed to Cloudflare nameservers
   - Propagation in progress (can take 15 min to 24 hours)

### Pending

- [ ] Nameserver propagation to complete
- [ ] Cloudflare confirmation email
- [ ] Update CSP headers to allow `api.keeprstay.com`
- [ ] Final verification of all endpoints
- [ ] SSL certificate verification

### Current Railway Domains (still work as fallback)

- Web: `campreservweb-production.up.railway.app`
- API: `camp-everydayapi-production.up.railway.app`

### Verification URLs (once live)

- https://keeprstay.com - Main site
- https://www.keeprstay.com - WWW redirect
- https://api.keeprstay.com/health - API health check

### Cloudflare R2 Storage (existing)

- Bucket: `camp-everyday-uploads`
- CDN: `https://pub-b0e741601dad4c3b8f98d3a6991c858b.r2.dev`
