import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { randomBytes, timingSafeEqual, createHmac } from "crypto";

/**
 * CSRF Token Service
 *
 * Implements a Double Submit Cookie pattern for CSRF protection.
 * This is a stateless approach that works well with JWT authentication.
 *
 * How it works:
 * 1. Server generates a token and sets it in a cookie (httpOnly: false so JS can read it)
 * 2. Client includes the token in a header (X-CSRF-Token) with each mutating request
 * 3. Server verifies the header matches the cookie
 */
@Injectable()
export class CsrfService {
  private readonly secret: string;
  private readonly tokenLength = 32;
  private readonly cookieName = "csrf_token";
  private readonly headerName = "x-csrf-token";

  constructor() {
    // Use a secret for HMAC signing of tokens
    const isProduction = process.env.NODE_ENV === "production";
    const envSecret = process.env.CSRF_SECRET || process.env.JWT_SECRET;

    if (!envSecret && isProduction) {
      throw new InternalServerErrorException(
        "[SECURITY] CSRF_SECRET or JWT_SECRET must be set in production",
      );
    }

    // In development, use a random secret (tokens won't persist across restarts, but that's fine for dev)
    this.secret = envSecret || require("crypto").randomBytes(32).toString("hex");
  }

  /**
   * Generate a new CSRF token
   * Returns both the token and a signed version for verification
   */
  generateToken(): { token: string; signature: string } {
    const token = randomBytes(this.tokenLength).toString("hex");
    const signature = this.signToken(token);
    return { token, signature };
  }

  /**
   * Sign a token with HMAC
   */
  private signToken(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("hex");
  }

  /**
   * Verify that a token matches its signature
   */
  verifyToken(token: string, signature: string): boolean {
    if (!token || !signature) {
      return false;
    }

    try {
      const expectedSignature = this.signToken(token);

      // Use timing-safe comparison to prevent timing attacks
      const tokenBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (tokenBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(tokenBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Create a combined token for the cookie (token:signature)
   */
  createCookieValue(): string {
    const { token, signature } = this.generateToken();
    return `${token}:${signature}`;
  }

  /**
   * Parse and verify a cookie value
   */
  parseCookieValue(cookieValue: string): { token: string; valid: boolean } {
    if (!cookieValue) {
      return { token: "", valid: false };
    }

    const parts = cookieValue.split(":");
    if (parts.length !== 2) {
      return { token: "", valid: false };
    }

    const [token, signature] = parts;
    const valid = this.verifyToken(token, signature);

    return { token, valid };
  }

  /**
   * Verify CSRF protection for a request
   * Compares the token from the cookie with the token from the header
   */
  validateRequest(cookieToken: string, headerToken: string): boolean {
    if (!cookieToken || !headerToken) {
      return false;
    }

    const { token, valid } = this.parseCookieValue(cookieToken);

    if (!valid) {
      return false;
    }

    // Compare the token from the cookie with the token from the header
    // Use timing-safe comparison
    try {
      const cookieBuffer = Buffer.from(token, "utf8");
      const headerBuffer = Buffer.from(headerToken, "utf8");

      if (cookieBuffer.length !== headerBuffer.length) {
        return false;
      }

      return timingSafeEqual(cookieBuffer, headerBuffer);
    } catch {
      return false;
    }
  }

  get cookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";

    return {
      httpOnly: false, // Must be false so JavaScript can read it
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  getCookieName(): string {
    return this.cookieName;
  }

  getHeaderName(): string {
    return this.headerName;
  }
}
