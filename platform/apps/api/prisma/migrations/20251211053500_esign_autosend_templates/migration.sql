-- Add optional site/siteClass scoping and auto-send flag to document templates
ALTER TABLE "DocumentTemplate"
  ADD COLUMN "siteClassId" TEXT,
  ADD COLUMN "siteId" TEXT,
  ADD COLUMN "autoSend" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "DocumentTemplate_campgroundId_siteClassId_idx" ON "DocumentTemplate"("campgroundId", "siteClassId");
CREATE INDEX "DocumentTemplate_campgroundId_siteId_idx" ON "DocumentTemplate"("campgroundId", "siteId");

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_siteClassId_fkey" FOREIGN KEY ("siteClassId") REFERENCES "SiteClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
