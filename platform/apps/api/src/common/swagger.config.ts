import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from "@nestjs/swagger";
import { API_VERSIONS, CURRENT_VERSION } from "./api-version.middleware";

/**
 * OpenAPI 3.1 Specification Configuration
 *
 * Features:
 * - Full OpenAPI 3.1 spec generation
 * - Bearer token authentication
 * - OAuth2 client credentials flow
 * - API versioning documentation
 * - Categorized endpoints via @ApiTags
 */

export interface SwaggerOptions {
  title?: string;
  description?: string;
  version?: string;
  path?: string;
  jsonPath?: string;
  includeModules?: any[];
  excludeModules?: any[];
}

const DEFAULT_DESCRIPTION = `
# Campreserv Developer API

Welcome to the Campreserv API documentation. This API enables external integrations
for campground and RV park management.

## Authentication

The API supports two authentication methods:

### 1. API Token (Recommended)
Use OAuth2 client credentials to obtain an access token:

\`\`\`bash
curl -X POST https://api.campreserv.com/api/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'
\`\`\`

Then include the token in requests:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### 2. OAuth2 Authorization Code (For User Context)
For applications acting on behalf of users, use the authorization code flow with PKCE.

## Rate Limiting

| Tier | Requests/Hour | Burst (per min) | Daily Limit |
|------|---------------|-----------------|-------------|
| Free | 100 | 20 | 1,000 |
| Standard | 1,000 | 100 | 10,000 |
| Enterprise | 10,000 | 500 | 100,000 |

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests per hour
- \`X-RateLimit-Remaining\`: Requests remaining in window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets
- \`X-RateLimit-Tier\`: Your current tier

## Versioning

The API uses URL path versioning. Currently supported: **v1**

Include the version in the URL path:
\`\`\`
GET /api/v1/reservations
\`\`\`

Or use the \`X-API-Version\` header:
\`\`\`
X-API-Version: 1.0
\`\`\`

## Scopes

API tokens have specific scopes that limit access:

| Scope | Description |
|-------|-------------|
| \`reservations:read\` | View reservations |
| \`reservations:write\` | Create/update reservations |
| \`guests:read\` | View guest records |
| \`guests:write\` | Create/update guests |
| \`sites:read\` | View campsite information |
| \`sites:write\` | Manage campsites |
| \`webhooks:read\` | View webhook configurations |
| \`webhooks:write\` | Manage webhooks |

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Description of the error",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/resource"
}
\`\`\`

## Support

For API support, contact: api-support@campreserv.com
`;

/**
 * Configure Swagger/OpenAPI documentation
 */
export function configureSwagger(
  app: INestApplication,
  options: SwaggerOptions = {}
): OpenAPIObject {
  const {
    title = "Campreserv API",
    description = DEFAULT_DESCRIPTION,
    version = API_VERSIONS[CURRENT_VERSION].version,
    path = "api/docs",
    jsonPath = "api/docs-json",
  } = options;

  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .setContact(
      "Campreserv API Support",
      "https://campreserv.com/developers",
      "api-support@campreserv.com"
    )
    .setLicense("Proprietary", "https://campreserv.com/terms")
    .setTermsOfService("https://campreserv.com/terms")
    .addServer("https://api.campreserv.com", "Production")
    .addServer("http://localhost:4000", "Development")
    // Bearer token auth
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your API access token",
      },
      "bearer"
    )
    // OAuth2 client credentials
    .addOAuth2(
      {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "/api/oauth/token",
            scopes: {
              "reservations:read": "View reservations",
              "reservations:write": "Create and update reservations",
              "guests:read": "View guest records",
              "guests:write": "Create and update guests",
              "sites:read": "View campsite information",
              "sites:write": "Manage campsites",
              "webhooks:read": "View webhook configurations",
              "webhooks:write": "Manage webhooks",
              "tokens:read": "View API tokens",
              "tokens:write": "Manage API tokens",
            },
          },
          authorizationCode: {
            authorizationUrl: "/api/oauth/authorize",
            tokenUrl: "/api/oauth/token",
            scopes: {
              "reservations:read": "View reservations",
              "reservations:write": "Create and update reservations",
              "guests:read": "View guest records",
              "guests:write": "Create and update guests",
              "sites:read": "View campsite information",
              "sites:write": "Manage campsites",
            },
          },
        },
      },
      "oauth2"
    )
    // API key in header
    .addApiKey(
      {
        type: "apiKey",
        name: "X-API-Key",
        in: "header",
        description: "Legacy API key authentication",
      },
      "api-key"
    )
    // Common headers
    .addGlobalParameters({
      name: "X-Campground-Id",
      in: "header",
      required: false,
      description: "Target campground ID for multi-tenant operations",
      schema: { type: "string" },
    })
    .addGlobalParameters({
      name: "X-API-Version",
      in: "header",
      required: false,
      description: "API version (defaults to latest)",
      schema: { type: "string", default: "1.0" },
    })
    .addGlobalParameters({
      name: "Idempotency-Key",
      in: "header",
      required: false,
      description: "Unique key for idempotent operations (POST/PUT/PATCH)",
      schema: { type: "string" },
    })
    // Tags for organization
    .addTag("Authentication", "OAuth2 and API token management")
    .addTag("Reservations", "Reservation management endpoints")
    .addTag("Guests", "Guest record management")
    .addTag("Sites", "Campsite and accommodation management")
    .addTag("Webhooks", "Webhook configuration and management")
    .addTag("Developer", "API client and token management")
    .build();

  // Create document with module filtering if specified
  const documentOptions: any = {
    deepScanRoutes: true,
  };

  if (options.includeModules?.length) {
    documentOptions.include = options.includeModules;
  }

  const document = SwaggerModule.createDocument(app, config, documentOptions);

  // Add OpenAPI 3.1 specific extensions
  (document as any).openapi = "3.1.0";

  // Add common response schemas
  addCommonSchemas(document);

  // Setup Swagger UI
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      docExpansion: "none",
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: "monokai",
      },
    },
    customSiteTitle: "Campreserv API Docs",
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin-bottom: 20px; }
      .swagger-ui .info .title { font-size: 2rem; }
    `,
  });

  // Serve raw JSON spec
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(`/${jsonPath}`, (req: any, res: any) => {
    res.json(document);
  });

  return document;
}

/**
 * Add common response schemas to the OpenAPI document
 */
function addCommonSchemas(document: OpenAPIObject): void {
  if (!document.components) {
    document.components = {};
  }
  if (!document.components.schemas) {
    document.components.schemas = {};
  }

  // Error response schema
  document.components.schemas["ErrorResponse"] = {
    type: "object",
    properties: {
      statusCode: { type: "integer", example: 400 },
      error: { type: "string", example: "Bad Request" },
      message: { type: "string", example: "Validation failed" },
      code: { type: "string", example: "VALIDATION_ERROR" },
      timestamp: { type: "string", format: "date-time" },
      path: { type: "string", example: "/api/v1/resource" },
      requestId: { type: "string", example: "req_abc123" },
    },
    required: ["statusCode", "error", "message", "timestamp", "path"],
  };

  // Rate limit error
  document.components.schemas["RateLimitError"] = {
    type: "object",
    properties: {
      statusCode: { type: "integer", example: 429 },
      error: { type: "string", example: "Too Many Requests" },
      message: { type: "string", example: "Rate limit exceeded" },
      code: { type: "string", example: "RATE_LIMIT_EXCEEDED" },
      retryAfter: { type: "integer", example: 60 },
      limit: { type: "integer", example: 100 },
      remaining: { type: "integer", example: 0 },
      resetAt: { type: "string", format: "date-time" },
    },
  };

  // Pagination response
  document.components.schemas["PaginatedResponse"] = {
    type: "object",
    properties: {
      data: { type: "array", items: {} },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 100 },
          totalPages: { type: "integer", example: 5 },
          hasMore: { type: "boolean", example: true },
        },
      },
    },
  };

  // OAuth token response
  document.components.schemas["TokenResponse"] = {
    type: "object",
    properties: {
      token_type: { type: "string", example: "Bearer" },
      access_token: { type: "string" },
      refresh_token: { type: "string" },
      expires_in: { type: "integer", example: 3600 },
      scope: { type: "string", example: "reservations:read guests:read" },
      campground_id: { type: "string" },
    },
    required: ["token_type", "access_token", "expires_in"],
  };
}

/**
 * Export for enhanced swagger configuration in main.ts
 */
export { DocumentBuilder, SwaggerModule };
