import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Seeds are dev-only; use transpile-only to avoid strict TS type noise
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
  datasource: {
    // Prefer DATABASE_URL, fallback to PLATFORM_DATABASE_URL for local dev parity
    url: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
    // Direct connection for migrations (bypasses PgBouncer)
    directUrl: process.env.DIRECT_URL,
    // Required for prisma migrate diff against migrations directory in Prisma 7+
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
