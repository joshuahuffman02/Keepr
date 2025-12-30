import { Injectable, NestMiddleware, Logger, BadRequestException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

/**
 * API Version configuration
 */
export const API_VERSIONS = {
  v1: {
    version: "1.0",
    deprecated: false,
    deprecationDate: null as string | null,
    sunsetDate: null as string | null,
  },
} as const;

export type ApiVersionKey = keyof typeof API_VERSIONS;

export const CURRENT_VERSION: ApiVersionKey = "v1";
export const SUPPORTED_VERSIONS: ApiVersionKey[] = ["v1"];

/**
 * Extend Express Request with version info
 */
export interface VersionedRequest extends Request {
  apiVersion?: string;
  apiVersionKey?: ApiVersionKey;
}

/**
 * API Versioning Middleware
 *
 * Supports versioning via:
 * 1. URL path prefix: /v1/resource
 * 2. Header: X-API-Version: 1.0
 *
 * Adds deprecation warnings to response headers when using deprecated versions.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiVersionMiddleware.name);

  use(req: VersionedRequest, res: Response, next: NextFunction): void {
    let version: ApiVersionKey | null = null;

    // 1. Check URL path for version prefix (e.g., /api/v1/...)
    const pathVersion = this.extractVersionFromPath(req.path);
    if (pathVersion) {
      version = pathVersion;
    }

    // 2. Check X-API-Version header (takes precedence over path)
    const headerVersion = req.headers["x-api-version"];
    if (headerVersion) {
      const parsedVersion = this.parseHeaderVersion(headerVersion as string);
      if (parsedVersion) {
        version = parsedVersion;
      }
    }

    // 3. Default to current version if not specified
    if (!version) {
      version = CURRENT_VERSION;
    }

    // Validate version is supported
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new BadRequestException(
        `API version "${version}" is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`
      );
    }

    // Attach version info to request
    req.apiVersion = API_VERSIONS[version].version;
    req.apiVersionKey = version;

    // Set version response header
    res.setHeader("X-API-Version", API_VERSIONS[version].version);

    // Add deprecation headers if applicable
    const versionConfig = API_VERSIONS[version];
    if (versionConfig.deprecated) {
      res.setHeader("Deprecation", versionConfig.deprecationDate || "true");
      res.setHeader(
        "X-API-Deprecation-Warning",
        `API version ${version} is deprecated. Please migrate to the latest version.`
      );

      if (versionConfig.sunsetDate) {
        res.setHeader("Sunset", versionConfig.sunsetDate);
      }

      // Link to migration docs (can be configured)
      res.setHeader(
        "Link",
        `</api/docs/migration>; rel="deprecation"; type="text/html"`
      );

      this.logger.warn(
        `Deprecated API version ${version} used by ${req.ip} on ${req.method} ${req.path}`
      );
    }

    next();
  }

  /**
   * Extract version from URL path (e.g., /api/v1/... -> v1)
   */
  private extractVersionFromPath(path: string): ApiVersionKey | null {
    const match = path.match(/\/v(\d+)\//);
    if (match) {
      const versionKey = `v${match[1]}` as ApiVersionKey;
      if (versionKey in API_VERSIONS) {
        return versionKey;
      }
    }
    return null;
  }

  /**
   * Parse version from header (e.g., "1.0" -> v1)
   */
  private parseHeaderVersion(header: string): ApiVersionKey | null {
    const trimmed = header.trim();

    // Support formats: "1.0", "v1", "1"
    if (trimmed.startsWith("v")) {
      const key = trimmed.toLowerCase() as ApiVersionKey;
      if (key in API_VERSIONS) {
        return key;
      }
    }

    // Parse numeric version like "1.0" or "1"
    const majorMatch = trimmed.match(/^(\d+)/);
    if (majorMatch) {
      const key = `v${majorMatch[1]}` as ApiVersionKey;
      if (key in API_VERSIONS) {
        return key;
      }
    }

    return null;
  }
}

/**
 * Helper to get version info from request
 */
export function getApiVersion(req: VersionedRequest): {
  version: string;
  key: ApiVersionKey;
} {
  return {
    version: req.apiVersion || API_VERSIONS[CURRENT_VERSION].version,
    key: req.apiVersionKey || CURRENT_VERSION,
  };
}

/**
 * Version-aware route decorator helper
 * Use this to define version-specific behavior in controllers
 */
export function isVersion(req: VersionedRequest, ...versions: ApiVersionKey[]): boolean {
  const currentVersion = req.apiVersionKey || CURRENT_VERSION;
  return versions.includes(currentVersion);
}
