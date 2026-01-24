import "reflect-metadata";
import "./otel";
import { Logger } from "@nestjs/common";
import { createApp, initializePrismaShutdownHooks } from "./app.bootstrap";
import { initializeSentry } from "./sentry";

const logger = new Logger("Bootstrap");

// Initialize Sentry FIRST to catch all errors (even during bootstrap)
initializeSentry();

async function bootstrap() {
  const app = await createApp();
  await initializePrismaShutdownHooks(app);

  const { configureSwagger } = await import("./app.bootstrap");
  configureSwagger(app);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Platform API running on http://localhost:${port}/api`);
}

bootstrap();

// cache bust 1765602220 - tsc fix for decorator metadata
// Build trigger: 1766613583
