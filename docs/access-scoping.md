## Access scoping

- Support and operations APIs enforce region/campground scope. Region mismatch or missing campground membership returns `403`.
- Scope guard reads `region`/`campgroundId` from query/body/headers and checks the authenticated user’s `region` and campground memberships.
- Mutations (support assignment/status, ops task/housekeeping updates) require matching scope; writes are denied otherwise.
- Use `GET /permissions/whoami` to see the current user, memberships, and allowed operations for the session. The frontend uses this to show scope and disable out-of-scope actions.
