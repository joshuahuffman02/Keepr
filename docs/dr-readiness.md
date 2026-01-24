# Disaster Recovery Runbook

**RPO/RTO targets:** RPO ≤ 15 minutes, RTO ≤ 60 minutes for API and database. Jobs and web redeploys are aligned with API RTO.

## Daily/continuous

- Backups: ensure DB backups every 15 minutes with 7-day retention; verify object storage versioning for assets.
- Health checks: `/api/ops/perf` and `/api/observability/snapshot` should return 200 with recent samples.
- Rate limits: defaults `${PERF_RATE_LIMIT_IP:-120}`/min and `${PERF_RATE_LIMIT_ORG:-240}`/min to contain traffic spikes; tune via env.

## Backup & restore steps

1. Identify restore point (timestamp ≤ 15m). Snapshot/point-in-time restore database to standby.
2. Point `DATABASE_URL` (and any Prisma URL overrides) to the restored instance.
3. Warm API: `pnpm --dir platform/apps/api start` (or deploy) and confirm `/api/health` plus `/api/ops/perf`.
4. Rehydrate caches/queues if used (Redis optional); clear stale queue entries if the outage included failed jobs.

## Failover toggle (single-region baseline)

- Primary DB unreachable: flip `DATABASE_URL` to standby; restart API.
- Rate-limit spikes: lower `PERF_RATE_LIMIT_IP`/`PERF_RATE_LIMIT_ORG` temporarily and watch `/api/observability/snapshot` for recovery.

## Game day (quarterly)

- Simulate DB outage: block primary connection, measure RTO from detection → standby cutover → API healthy.
- Simulate traffic flood: replay with `k6` or similar to confirm 429s and no saturation of job queues.
- Validate data: run a quick reservation read/write and payment flow after failover; ensure no duplicate jobs fired.

## Ownership & logging

- Observability endpoints: `/api/ops/perf`, `/api/observability/snapshot`.
- Queue/backpressure: `campaign-dispatch`, `payout-recon` queues expose running/queued counts in the snapshot; alarms should watch failures > SLO.
- Rollback: revert `DATABASE_URL` to primary once stable; reconcile any stuck jobs manually using admin tools if needed.
