# 🚂 Railway Database Backup Setup

**Time:** 5 minutes
**Cost:** $5/month (worth it!)
**Importance:** CRITICAL - Protects your customer data

---

## Why You Need This

**Without backups:**

- Claude writes bad database migration → All data lost → Business over 💀

**With backups:**

- Claude writes bad migration → Restore from backup → Back online in 5 minutes ✅

---

## Setup Steps

### 1. Log into Railway

```bash
# Install Railway CLI (if not already)
brew install railway

# Login
railway login

# Link to your project
railway link
```

### 2. Enable Automated Backups

**Via Railway Dashboard:**

1. Go to https://railway.app/dashboard
2. Click on your project
3. Click on your PostgreSQL service
4. Go to "Settings" tab
5. Scroll to "Backup & Recovery"
6. Click "Enable Automated Backups"
7. Select backup frequency:
   - **Daily** (recommended for production)
   - **Hourly** (if you have lots of users)
8. Set retention period: **30 days** (recommended)

**Cost:** $5/month

### 3. Test the Backup

**Create a test backup:**

```bash
railway run --service postgresql pg_dump > test_backup.sql
```

**Restore from backup:**

```bash
railway run --service postgresql psql < test_backup.sql
```

If this works, you're good! ✅

---

## Backup Strategy

### Daily Workflow:

- Railway automatically backs up every day at 2 AM UTC
- Keep 30 days of backups
- Cost: $5/month

### Before Major Changes:

**Always create manual backup before:**

- Database migrations
- Data imports
- Schema changes
- Bulk updates

**Create manual backup:**

```bash
# Using Railway CLI
railway run --service postgresql pg_dump > backup_$(date +%Y%m%d).sql

# Or via Railway dashboard
# Services → PostgreSQL → Backups → Create Backup
```

---

## Restoration Process

### If Something Goes Wrong:

**1. Identify the issue**

```bash
# Check recent migrations
railway run --service postgresql psql -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

**2. Stop the API**

```bash
railway down --service api
```

**3. Restore from backup**

**Via Railway Dashboard:**

1. Go to PostgreSQL service
2. Click "Backups" tab
3. Find the backup from before the issue
4. Click "Restore"
5. Confirm restoration

**Via CLI:**

```bash
# List available backups
railway backups list

# Restore specific backup
railway backups restore <backup-id>
```

**4. Restart the API**

```bash
railway up --service api
```

**5. Verify data**

```bash
# Check a few critical records
railway run --service postgresql psql -c "SELECT COUNT(*) FROM reservations;"
railway run --service postgresql psql -c "SELECT COUNT(*) FROM payments;"
```

---

## Recovery Time Objectives

| Scenario            | Recovery Time |
| ------------------- | ------------- |
| Bad migration       | 5-10 minutes  |
| Data corruption     | 10-15 minutes |
| Accidental deletion | 5 minutes     |
| Total database loss | 15-30 minutes |

---

## Backup Checklist

**Before Every Migration:**

- [ ] Create manual backup
- [ ] Note the backup ID
- [ ] Have restoration command ready
- [ ] Test in development first

**After Every Migration:**

- [ ] Verify data integrity
- [ ] Check row counts
- [ ] Test critical queries
- [ ] Monitor Sentry for errors

**Weekly:**

- [ ] Verify automated backups are running
- [ ] Test a backup restoration
- [ ] Check backup storage usage

---

## Local Backups (Extra Safety)

**Keep a local copy weekly:**

```bash
# Backup to local file
railway run --service postgresql pg_dump > backups/weekly_$(date +%Y%m%d).sql

# Compress it
gzip backups/weekly_$(date +%Y%m%d).sql

# Upload to cloud storage (optional)
# aws s3 cp backups/weekly_$(date +%Y%m%d).sql.gz s3://your-bucket/
```

**Keep:**

- Last 4 weekly backups locally
- All daily backups in Railway (30 days)
- Monthly backups in S3 (forever)

---

## Common Issues

**Q: Backup failed?**
A: Check disk space in Railway dashboard. Upgrade plan if needed.

**Q: Restoration taking too long?**
A: Large databases (>10GB) take longer. Upgrade to Pro plan for faster restoration.

**Q: Want point-in-time recovery?**
A: Upgrade to Railway Pro ($20/month) - gives you restoration to any point in time.

---

## Cost Breakdown

| Plan        | Cost         | Features                           |
| ----------- | ------------ | ---------------------------------- |
| Hobby       | Free         | No backups ❌                      |
| **Starter** | **$5/month** | **Daily backups (recommended)** ✅ |
| Pro         | $20/month    | Point-in-time recovery ✅          |

**Recommendation:** Start with $5/month. Worth every penny for peace of mind.

---

## Emergency Contact

**If backups are corrupted or lost:**

1. Contact Railway support immediately: support@railway.app
2. They keep backups of backups (seriously!)
3. Recovery time: 1-2 hours

---

## Summary

✅ Enable automated backups ($5/month)
✅ Manual backup before migrations
✅ Test restoration monthly
✅ Keep local copies weekly
✅ Never skip backups

**Your data is your business. Protect it!** 🛡️
