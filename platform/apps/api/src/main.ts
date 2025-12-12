import "reflect-metadata";
import { createApp, initializePrismaShutdownHooks } from "./app.bootstrap";

async function bootstrap() {
  const app = await createApp();
  await initializePrismaShutdownHooks(app);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Platform API running on http://localhost:${port}/api`);
}

bootstrap();

