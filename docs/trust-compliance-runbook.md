# Trust, Compliance & Controls Runbook

## Backups & retention

- Primary DB: retain daily snapshots for 30 days (configurable via `PrivacySetting.backupRetentionDays`).
- Rotation: verify backups weekly; test restore monthly in staging.
- Key management: rotate encryption keys every `keyRotationDays` (default 90); document rotation time and version.
- Erasure/retention: use retention date (`AuditLog.retentionAt`) to schedule deletions; approvals needed for early deletion.

## Audit trails

- Every sensitive action should call `AuditService.record` with actor, entity, before/after, IP/User-Agent.
- Tamper-evident chain: `chainHash` and `prevHash` are computed per campground; export includes hashes.
- Export: `GET /campgrounds/:id/audit?format=csv|json` (requires permission) logs an `AuditExport` row.

## Approvals

- Approval policies live in `ApprovalPolicy`; requests in `ApprovalRequest`.
- Require approval for actions like refunds or PII export using `PermissionsService.requestApproval`.
- Decision path: approver calls `POST /permissions/approvals/:id/decision` with approve/deny.

## RBAC and field-level controls

- Rules stored in `PermissionRule` with `allow/deny` effects and optional field masks.
- Use `@RequirePermission({ resource, action })` + `PermissionGuard` on sensitive endpoints.

## Privacy & PII

- PII classifications stored in `PiiFieldTag`; redaction modes `mask` or `remove`.
- Consent logging: `ConsentLog` captures subject, type, method, purpose, expiry; view via admin UI.
- Privacy settings per campground: redact PII in responses/logs, consent requirement flag, retention + key rotation.

## DPA/subject requests

- For access/erasure: query `AuditLog` and `ConsentLog` for subject identifiers; apply redaction/removal per `PiiFieldTag`.
- Record outcome in `ApprovalRequest` with action `subject_request` and link to actor.

## Operator checklist

- Weekly: review open approval requests; verify audit exports access limited to managers/owners.
- Monthly: confirm backup restore drill, key rotation schedule, and consent log sampling.
- Quarterly: review permission rules and PII field tags for coverage.
