-- Manual index: CREATE INDEX CONCURRENTLY cannot run inside Prisma migrations.
-- Run the statement below manually against production, then keep this file as documentation.
-- See AGENTS.md for the execution note.

CREATE INDEX CONCURRENTLY "Campground_public_createdAt_idx"
ON public."Campground" ("createdAt", "id")
WHERE ("isPublished" = true OR "isExternal" = true)
  AND "deletedAt" IS NULL;
