import "reflect-metadata";
import serverlessExpress from "@codegenie/serverless-express";
import type { Handler, Context, Callback } from "aws-lambda";
import { createApp } from "./app.bootstrap";
import type { ExpressAdapter } from "@nestjs/platform-express";

let cachedServer: Handler | undefined;

async function bootstrap(): Promise<Handler> {
    const app = await createApp();
    await app.init();

    const expressApp = app.getHttpAdapter().getInstance();
    return serverlessExpress({ app: expressApp });
}

// Vercel serverless handler
export const handler: Handler = async (
    event: any,
    context: Context,
    callback: Callback
) => {
    // Keep the connection alive between invocations
    context.callbackWaitsForEmptyEventLoop = false;

    // Cache the server instance for warm starts
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }

    return cachedServer(event, context, callback);
};

// Export for Vercel
export default handler;
