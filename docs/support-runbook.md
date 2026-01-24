## Support & helpdesk runbook

- Scope: `GET /support/reports` requires auth + `support:read` scope and roles `owner|manager|support`. Requested `region` must match the user’s region; otherwise a `403` is returned. `campgroundId` filters results but still respects region.
- Writes: updates/assignments require `support:write`/`support:assign` and the same roles. Cross-region updates are blocked; assignment is denied if the assignee lacks the report’s region or campground membership.
- Data shape: reports carry `rawContext.region` and optional `campgroundId` to drive scoping and filtering.
- Alerts: Slack webhook is optional via `SUPPORT_SLACK_WEBHOOK`; email fan-out uses a comma-separated `SUPPORT_ALERT_EMAILS`. Both send concise summaries and are best-effort (errors are logged).
- Oncall checks: verify the region on the session (`req.user.region`) matches requested filters, confirm assignee region/memberships before reassigning, and prefer region-filtered directory lookups when paging support staff.
