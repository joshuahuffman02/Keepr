import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { CampgroundsService } from "../campgrounds/campgrounds.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const svc = app.get(CampgroundsService);

  const bbox = process.env.OSM_INGEST_BBOX;
  const limit = process.env.OSM_INGEST_LIMIT ? Number(process.env.OSM_INGEST_LIMIT) : undefined;

  const start = Date.now();
  const { processed, upserted } = await svc.ingestFromOsm({ bbox, limit });
  const ms = Date.now() - start;

  console.log(JSON.stringify({ processed, upserted, ms }, null, 2));
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
