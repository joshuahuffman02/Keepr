import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";

async function generate() {
    const app = await NestFactory.create(AppModule, { logger: false });

    const config = new DocumentBuilder()
        .setTitle("CampReserv Public API")
        .setDescription("API for external integrations and developers")
        .setVersion("1.0")
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        deepScanRoutes: true
    });

    const outputPath = path.resolve(process.cwd(), "openapi.json");
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log(`OpenAPI spec generated at ${outputPath}`);

    await app.close();
    process.exit(0);
}

generate();
