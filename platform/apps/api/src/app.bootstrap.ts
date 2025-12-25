import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import * as dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { PerfInterceptor } from "./perf/perf.interceptor";
import { RateLimitInterceptor } from "./perf/rate-limit.interceptor";
import { PerfService } from "./perf/perf.service";
import { RateLimitService } from "./perf/rate-limit.service";
import { ObservabilityService } from "./observability/observability.service";
import { RedactingLogger } from "./logger/redacting.logger";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import type { Request, Response, NextFunction } from "express";
import { DeveloperApiModule } from "./developer-api/developer-api.module";

// Shared app configuration - used by both local dev and serverless
export async function createApp(): Promise<INestApplication> {
    dotenv.config();
    const bodyLimit = process.env.API_BODY_LIMIT || "25mb";

    const app = await NestFactory.create(AppModule, {
        logger: new RedactingLogger(),
        bodyParser: false
    });

    // CORS configuration - environment-aware
    const allowedOrigins = [
        // Production frontend
        "https://campreservweb-production.up.railway.app",
        // Development
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ];

    // Add custom allowed origins from environment
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").filter(Boolean) || [];
    allowedOrigins.push(...envOrigins);

    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
                return callback(null, true);
            }
            // Allow ngrok and other dev tunnels
            if (origin.includes("ngrok") || origin.includes("railway.app") || origin.includes("localhost")) {
                return callback(null, true);
            }
            // Check explicit whitelist
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            // Reject unknown origins in production
            if (process.env.NODE_ENV === "production") {
                return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
            }
            // Allow in development
            return callback(null, true);
        },
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
            "X-Onboarding-Token",
            "Idempotency-Key",
        ],
        optionsSuccessStatus: 204,
        preflightContinue: false,
    });

    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Cookie parser for CSRF and session handling
    app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

    // Security headers via helmet
    const isProduction = process.env.NODE_ENV === "production";
    const frontendUrl = process.env.FRONTEND_URL || "https://campreservweb-production.up.railway.app";

    app.use(
        helmet({
            // Content Security Policy - restrict script sources
            contentSecurityPolicy: isProduction ? {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: [
                        "'self'",
                        frontendUrl,
                        "https://api.stripe.com",
                        "wss://*.stripe.com",
                        "https://maps.googleapis.com"
                    ],
                    frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: [],
                },
            } : false, // Disable CSP in development for easier debugging

            // HTTP Strict Transport Security - force HTTPS
            strictTransportSecurity: isProduction ? {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true,
            } : false,

            // Prevent clickjacking
            frameguard: { action: "deny" },

            // Prevent MIME type sniffing
            noSniff: true,

            // XSS Protection (legacy but still useful)
            xssFilter: true,

            // Hide X-Powered-By header
            hidePoweredBy: true,

            // Referrer Policy
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },

            // Cross-Origin policies
            crossOriginEmbedderPolicy: false, // Can break some embeds
            crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
            crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow API access
        })
    );
    console.log("[BOOTSTRAP] Security headers (helmet) enabled");

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
            limit: bodyLimit,
            verify: (req: any, _res: any, buf: Buffer) => {
                req.rawBody = buf;
            }
        })
    );
    app.use(
        express.urlencoded({
            extended: true,
            limit: bodyLimit,
            verify: (req: any, _res: any, buf: Buffer) => {
                req.rawBody = buf;
            }
        })
    );

    // Global interceptors for rate limiting and performance monitoring
    try {
        const perfService = app.get(PerfService);
        const rateLimitService = app.get(RateLimitService);
        const observabilityService = app.get(ObservabilityService);
        app.useGlobalInterceptors(
            new RateLimitInterceptor(rateLimitService, perfService),
            new PerfInterceptor(perfService, observabilityService)
        );
        console.log("[BOOTSTRAP] Global interceptors enabled: RateLimit, Perf");
    } catch (err) {
        console.error("[BOOTSTRAP] Failed to initialize global interceptors:", err);
        // Continue without interceptors rather than crashing
    }

    // Global exception filter for consistent error handling
    try {
        const httpAdapterHost = app.get(HttpAdapterHost);
        app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
        console.log("[BOOTSTRAP] Global exception filter enabled");
    } catch (err) {
        console.error("[BOOTSTRAP] Failed to initialize global exception filter:", err);
    }

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
            DeveloperApiModule
        ],
        deepScanRoutes: true
    });

    SwaggerModule.setup("api/docs", app, document);
}
