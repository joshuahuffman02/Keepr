import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import * as dotenv from "dotenv";
import { PerfInterceptor } from "./perf/perf.interceptor";
import { RateLimitInterceptor } from "./perf/rate-limit.interceptor";
import { PerfService } from "./perf/perf.service";
import { RateLimitService } from "./perf/rate-limit.service";
import { ObservabilityService } from "./observability/observability.service";
import { RedactingLogger } from "./logger/redacting.logger";
import type { Request, Response, NextFunction } from "express";

// Shared app configuration - used by both local dev and serverless
export async function createApp(): Promise<INestApplication> {
    dotenv.config();

    const app = await NestFactory.create(AppModule, {
        logger: new RedactingLogger(),
        bodyParser: false
    });

    // CORS configuration
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

    // CORS middleware for dev/ngrok
    app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin || "*";
        res.header("Access-Control-Allow-Origin", origin as string);
        res.header("Vary", "Origin");
        res.header(
            "Access-Control-Allow-Headers",
            (req.headers["access-control-request-headers"] as string) ||
            "Content-Type, Authorization, X-Campground-Id, X-Organization-Id, X-Portfolio-Id, X-Park-Id, X-Locale, X-Currency, X-Client, Accept, X-Requested-With"
        );
        res.header(
            "Access-Control-Allow-Methods",
            (req.headers["access-control-request-method"] as string) || "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
        );
        res.header("Access-Control-Allow-Credentials", "true");
        if (req.method === "OPTIONS") {
            return res.status(204).send();
        }
        next();
    });

    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Scope middleware
    app.use((req: Request, _res: Response, next: NextFunction) => {
        const headers = req.headers as Record<string, any>;
        const cgHeader = headers["x-campground-id"];
        const orgHeader = headers["x-organization-id"];
        (req as any).campgroundId = Array.isArray(cgHeader) ? cgHeader[0] : cgHeader || null;
        (req as any).organizationId = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader || null;
        next();
    });

    // Body parser with raw body for webhooks (using Express 5 built-in)
    const express = await import("express");
    app.use(
        express.json({
            verify: (req: any, _res: any, buf: Buffer) => {
                req.rawBody = buf;
            }
        })
    );
    app.use(
        express.urlencoded({
            extended: true,
            verify: (req: any, _res: any, buf: Buffer) => {
                req.rawBody = buf;
            }
        })
    );

    // Global interceptors - TEMPORARILY DISABLED for Railway deployment
    // TODO: Re-enable after fixing ObservabilityService initialization
    // const perfService = app.get(PerfService);
    // const rateLimitService = app.get(RateLimitService);
    // const observabilityService = app.get(ObservabilityService);
    // app.useGlobalInterceptors(
    //     new RateLimitInterceptor(rateLimitService, perfService),
    //     new PerfInterceptor(perfService, observabilityService)
    // );

    return app;
}

// Initialize Prisma shutdown hooks (only for long-running server mode)
export async function initializePrismaShutdownHooks(app: INestApplication): Promise<void> {
    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);
}

export function configureSwagger(app: INestApplication): void {
    const { DocumentBuilder, SwaggerModule } = require("@nestjs/swagger");

    const config = new DocumentBuilder()
        .setTitle("CampReserv Public API")
        .setDescription("API for external integrations and developers")
        .setVersion("1.0")
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        include: [
            // We will import the DeveloperApiModule here ideally, or let it scan everything
            // For now, let's scan everything but typically strict scoping is better
        ],
        deepScanRoutes: true
    });

    SwaggerModule.setup("api/docs", app, document);
}

