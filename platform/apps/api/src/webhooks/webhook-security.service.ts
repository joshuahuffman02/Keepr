import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook Security Service
 *
 * Provides HMAC-SHA256 signature generation and verification for webhook payloads.
 * Includes timestamp-based replay attack prevention.
 *
 * Signature Format:
 *   Header: X-Campreserv-Signature
 *   Value: v1=<hex_digest>
 *
 * Timestamp Header:
 *   Header: X-Campreserv-Timestamp
 *   Value: Unix timestamp in seconds
 *
 * Signature is computed as:
 *   HMAC-SHA256(secret, timestamp + "." + payload)
 */
@Injectable()
export class WebhookSecurityService {
  // Maximum age of a webhook signature before it's considered stale (5 minutes)
  private readonly SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

  /**
   * Generate HMAC-SHA256 signature for a webhook payload
   *
   * @param secret - The webhook endpoint's secret key
   * @param payload - The JSON payload string
   * @param timestampSeconds - Unix timestamp in seconds
   * @returns Object containing signature header value and timestamp
   */
  generateSignature(
    secret: string,
    payload: string,
    timestampSeconds?: number,
  ): { signature: string; timestamp: number } {
    const timestamp = timestampSeconds || Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payload}`;

    const hmac = createHmac("sha256", secret);
    hmac.update(signaturePayload);
    const digest = hmac.digest("hex");

    return {
      signature: `v1=${digest}`,
      timestamp,
    };
  }

  /**
   * Generate a legacy-format signature for backward compatibility
   * Format: t=<timestamp>,v1=<digest>
   *
   * @param secret - The webhook endpoint's secret key
   * @param payload - The JSON payload string
   * @param timestampMs - Unix timestamp in milliseconds
   * @returns Combined signature string
   */
  generateLegacySignature(secret: string, payload: string, timestampMs: number): string {
    const signaturePayload = `${timestampMs}.${payload}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(signaturePayload);
    const digest = hmac.digest("hex");
    return `t=${timestampMs},v1=${digest}`;
  }

  /**
   * Verify a webhook signature
   *
   * @param secret - The webhook endpoint's secret key
   * @param payload - The raw JSON payload string
   * @param signatureHeader - The X-Campreserv-Signature header value
   * @param timestampHeader - The X-Campreserv-Timestamp header value
   * @returns true if signature is valid
   * @throws UnauthorizedException if signature is invalid or too old
   */
  verifySignature(
    secret: string,
    payload: string,
    signatureHeader: string,
    timestampHeader: string | number,
  ): boolean {
    // Parse timestamp
    const timestamp =
      typeof timestampHeader === "string" ? parseInt(timestampHeader, 10) : timestampHeader;

    if (isNaN(timestamp)) {
      throw new UnauthorizedException("Invalid timestamp");
    }

    // Check signature age (prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - timestamp;

    if (age > this.SIGNATURE_MAX_AGE_SECONDS) {
      throw new UnauthorizedException(
        `Signature too old. Age: ${age}s, Max: ${this.SIGNATURE_MAX_AGE_SECONDS}s`,
      );
    }

    if (age < -60) {
      // Allow 1 minute clock skew into the future
      throw new UnauthorizedException("Signature timestamp is in the future");
    }

    // Parse the signature header
    const signatureMatch = signatureHeader.match(/^v1=([a-f0-9]+)$/i);
    if (!signatureMatch) {
      throw new UnauthorizedException("Invalid signature format");
    }

    const providedSignature = signatureMatch[1];

    // Compute expected signature
    const { signature: expectedSignatureHeader } = this.generateSignature(
      secret,
      payload,
      timestamp,
    );
    const expectedSignature = expectedSignatureHeader.replace("v1=", "");

    // Constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (providedBuffer.length !== expectedBuffer.length) {
      throw new UnauthorizedException("Invalid signature");
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Invalid signature");
    }

    return true;
  }

  /**
   * Verify a legacy signature format (t=<timestamp>,v1=<digest>)
   *
   * @param secret - The webhook endpoint's secret key
   * @param payload - The raw JSON payload string
   * @param combinedSignature - The combined signature string
   * @returns true if signature is valid
   */
  verifyLegacySignature(secret: string, payload: string, combinedSignature: string): boolean {
    // Parse legacy format: t=<timestamp>,v1=<digest>
    const match = combinedSignature.match(/^t=(\d+),v1=([a-f0-9]+)$/i);
    if (!match) {
      throw new UnauthorizedException("Invalid legacy signature format");
    }

    const timestampMs = parseInt(match[1], 10);
    const providedSignature = match[2];

    // Check signature age
    const ageMs = Date.now() - timestampMs;
    if (ageMs > this.SIGNATURE_MAX_AGE_SECONDS * 1000) {
      throw new UnauthorizedException("Signature too old");
    }

    // Compute expected signature
    const signaturePayload = `${timestampMs}.${payload}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(signaturePayload);
    const expectedSignature = hmac.digest("hex");

    // Constant-time comparison
    const providedBuffer = Buffer.from(providedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (providedBuffer.length !== expectedBuffer.length) {
      throw new UnauthorizedException("Invalid signature");
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Invalid signature");
    }

    return true;
  }

  /**
   * Build webhook headers for delivery
   *
   * @param deliveryId - The unique delivery ID
   * @param signature - The computed signature
   * @param timestamp - Unix timestamp in seconds
   * @param attempt - The delivery attempt number
   * @returns Object with all webhook headers
   */
  buildDeliveryHeaders(
    deliveryId: string,
    signature: string,
    timestamp: number,
    attempt: number,
  ): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Campreserv-Signature": signature,
      "X-Campreserv-Timestamp": String(timestamp),
      "X-Campreserv-Delivery-Id": deliveryId,
      "X-Campreserv-Attempt": String(attempt),
      "User-Agent": "Campreserv-Webhooks/2.0",
    };
  }
}
