import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CampgroundsService } from "./campgrounds.service";

@Injectable()
export class CampgroundsIngestScheduler {
  private readonly logger = new Logger(CampgroundsIngestScheduler.name);

  constructor(private readonly campgrounds: CampgroundsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: "osm-ingest" })
  async handleOsmIngest() {
    if (process.env.OSM_INGEST_CRON_ENABLED !== "true") return;
    const limit = process.env.OSM_INGEST_LIMIT ? Number(process.env.OSM_INGEST_LIMIT) : undefined;
    const bbox = process.env.OSM_INGEST_BBOX;
    try {
      const { upserted, processed } = await this.campgrounds.ingestFromOsm({
        bbox,
        limit,
      });
      this.logger.log(`OSM ingest completed: processed=${processed}, upserted=${upserted}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`OSM ingest failed: ${message}`);
    }
  }
}
