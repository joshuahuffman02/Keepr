// Vercel Serverless Function - NestJS Integration
// Loads the bundled NestJS app from the api/ folder (copied during build)

const serverlessExpress = require("@codegenie/serverless-express");
let cachedApp;

async function bootstrap() {
  // Import the NestJS bootstrap function - now in same folder
  const { createApp } = require("./app.bootstrap.js");
  const app = await createApp();
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

module.exports = async (req, res) => {
  try {
    if (!cachedApp) {
      console.log("Initializing NestJS app...");
      cachedApp = await bootstrap();
      console.log("NestJS app initialized");
    }

    // Convert Vercel request format to AWS Lambda format for serverless-express
    const event = {
      httpMethod: req.method,
      path: req.url,
      headers: req.headers,
      body: req.body ? JSON.stringify(req.body) : null,
      queryStringParameters: req.query,
      requestContext: {},
    };

    const context = {
      callbackWaitsForEmptyEventLoop: false,
    };

    return new Promise((resolve, reject) => {
      cachedApp(event, context, (err, result) => {
        if (err) {
          console.error("Handler error:", err);
          reject(err);
        } else {
          // Set response headers and body
          Object.entries(result.headers || {}).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          res.status(result.statusCode || 200);
          res.send(result.body);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("NestJS initialization error:", error);
    res.status(500).json({
      error: "Failed to initialize API",
      message: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
};
