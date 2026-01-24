# Trust, Compliance & Controls Runbook (stub/test)

## Backups & retention

- Daily logical backups with 30-day retention (configurable per campground in privacy settings).
- Key rotation target: every 90 days (configurable).
- Verify restore quarterly; track last restore timestamp in ops notes.

## Approvals

- High-value refunds (> $500) require owner/manager approval.
- PII exports require owner/manager approval and must be redacted if possible.
- Owner role changes require owner approval only.

## Privacy & consent

- Redact PII in exports/logs when toggled on.
- Collect consent before messaging when enabled; log consent events (stubbed for testing).

## Notes

- Uses stub/test storage only—wire to real secrets/infra before GA.
