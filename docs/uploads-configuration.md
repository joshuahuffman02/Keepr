# Uploads (images) – enablement guide for staff

Current state

- UI supports pasting image URLs for events, campgrounds, sites, and site classes.
- Event creation also supports file upload if signing is enabled; otherwise it falls back to URL input.
- Backend is gated: no storage costs or uploads occur until env vars are set.

Backend setup (S3/R2/GCS S3-compatible)

1. Create a bucket (per environment). Block public ACLs; enable bucket-owner-enforced ACL and SSE.
2. Optional: put a CDN in front (CloudFront or R2 CDN) and note its base URL.
3. Set API env vars:
   - `UPLOADS_S3_BUCKET`
   - `UPLOADS_S3_REGION`
   - `UPLOADS_S3_ACCESS_KEY`
   - `UPLOADS_S3_SECRET_KEY`
   - `UPLOADS_CDN_BASE` (optional, e.g., https://cdn.example.com)
4. Deploy/restart API. The signing endpoint will respond at `POST /api/uploads/sign` with a presigned PUT URL and `publicUrl`.

How uploads work

- Client requests a signed URL with `{ filename, contentType }`.
- Server returns `{ uploadUrl, publicUrl, key }` (or 503 if uploads are disabled).
- Client PUTs the file to `uploadUrl` with the correct `Content-Type`, then saves `publicUrl` into the image field.

Where it’s wired today

- Events: `CreateEventDialog` uses signed upload when available; otherwise, URL input.
- Campgrounds, sites, site classes: URL inputs with previews. (Can be switched to uploader once storage is enabled.)

Future enhancements (after storage is ready)

- Swap campground/site/class photo inputs to use the uploader.
- Add size/type limits (e.g., max 5–10 MB, image/\*) on both client and server.
- Optional: add drag-reorder for galleries; add metadata (alt text).

Safety/disable

- If required env vars are missing, `/uploads/sign` returns 503 and the UI continues to accept URLs only.
