import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import * as dotenv from "dotenv";
import type { Request, Response } from "express";
import { PerfInterceptor } from "./perf/perf.interceptor";
import { RateLimitInterceptor } from "./perf/rate-limit.interceptor";
import { PerfService } from "./perf/perf.service";
import { RateLimitService } from "./perf/rate-limit.service";
import { ObservabilityService } from "./observability/observability.service";
import { RedactingLogger } from "./logger/redacting.logger";
import * as bodyParser from "body-parser";

async function bootstrap() {
  dotenv.config();
  const app = await NestFactory.create(AppModule, {
    logger: new RedactingLogger(),
    bodyParser: false
  });

  // Explicit CORS allowlist for web dev / ngrok
  // Development CORS: allow all origins while behind ngrok; tighten for prod as needed.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
	    allowedHeaders: [
	      "Content-Type",
	      "Authorization",
	      "X-Campground-Id",
	      "X-Organization-Id",
	      "X-Portfolio-Id",
	      "X-Park-Id",
	      "X-Locale",
	      "X-Currency",
	      "X-Client",
	      "Accept",
	      "X-Requested-With",
	    ],
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });
  // Additional dev override to ensure ngrok/browser preflights get a response
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin || "*";
    // Reflect the requesting origin for dev; tighten for prod as needed
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header(
	      "Access-Control-Allow-Headers",
	      req.headers["access-control-request-headers"] ||
	        "Content-Type, Authorization, X-Campground-Id, X-Organization-Id, X-Portfolio-Id, X-Park-Id, X-Locale, X-Currency, X-Client, Accept, X-Requested-With"
	    );
    res.header(
      "Access-Control-Allow-Methods",
      req.headers["access-control-request-method"] || "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }
    next();
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Simple owner-scope middleware: reads x-campground-id and x-organization-id, injects into request for services to use.
  app.use((req: Request, _res: Response, next: any) => {
    // Attach scope to request for downstream use
    const headers = req.headers as Record<string, any>;
    const cgHeader = headers["x-campground-id"];
    const orgHeader = headers["x-organization-id"];
    (req as any).campgroundId = Array.isArray(cgHeader) ? cgHeader[0] : cgHeader || null;
    (req as any).organizationId = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader || null;
    next();
  });

  // Preserve raw body for webhook signature verification
  app.use(
    bodyParser.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(
    bodyParser.urlencoded({
      extended: true,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const perfService = app.get(PerfService);
  const rateLimitService = app.get(RateLimitService);
  const observabilityService = app.get(ObservabilityService);
  app.useGlobalInterceptors(
    new RateLimitInterceptor(rateLimitService, perfService),
    new PerfInterceptor(perfService, observabilityService)
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Platform API running on http://localhost:${port}/api`);
}

bootstrap();
