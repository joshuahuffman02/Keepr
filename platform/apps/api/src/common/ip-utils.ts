/**
 * IP Address Utilities
 *
 * Provides secure extraction and validation of client IP addresses.
 * Guards against IP spoofing via x-forwarded-for header manipulation.
 */

/**
 * Regular expression for validating IPv4 addresses.
 * Matches: 0.0.0.0 through 255.255.255.255
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Regular expression for validating IPv6 addresses.
 * Simplified pattern that covers common formats including:
 * - Full form: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
 * - Compressed: 2001:db8:85a3::8a2e:370:7334
 * - IPv4-mapped: ::ffff:192.168.1.1
 * - Loopback: ::1
 */
const IPV6_REGEX =
  /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:ffff:(?:0{1,4}:)?)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))$/;

/**
 * Validates if a string is a valid IP address (IPv4 or IPv6).
 *
 * @param ip - The string to validate
 * @returns true if the string is a valid IP address
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") {
    return false;
  }

  // Remove IPv6 zone ID if present (e.g., %eth0)
  const cleanIp = ip.split("%")[0];

  return IPV4_REGEX.test(cleanIp) || IPV6_REGEX.test(cleanIp);
}

/**
 * Validates if a string is a valid IPv4 address.
 *
 * @param ip - The string to validate
 * @returns true if the string is a valid IPv4 address
 */
export function isValidIpv4(ip: string): boolean {
  if (!ip || typeof ip !== "string") {
    return false;
  }
  return IPV4_REGEX.test(ip);
}

/**
 * Validates if a string is a valid IPv6 address.
 *
 * @param ip - The string to validate
 * @returns true if the string is a valid IPv6 address
 */
export function isValidIpv6(ip: string): boolean {
  if (!ip || typeof ip !== "string") {
    return false;
  }
  // Remove zone ID if present
  const cleanIp = ip.split("%")[0];
  return IPV6_REGEX.test(cleanIp);
}

/**
 * Options for extracting client IP address.
 */
export interface ExtractClientIpOptions {
  /**
   * The x-forwarded-for header value.
   * Can be a string (single value) or array (multiple values).
   */
  forwardedFor?: string | string[];

  /**
   * The direct IP from the request (req.ip).
   */
  directIp?: string;

  /**
   * The remote address from the connection (req.connection?.remoteAddress).
   */
  remoteAddress?: string;
}

/**
 * Extracts and validates the client IP address from request headers.
 *
 * This function safely extracts IP addresses from various sources in order of preference:
 * 1. x-forwarded-for header (first valid IP only)
 * 2. Direct request IP (req.ip)
 * 3. Connection remote address
 *
 * Security: The x-forwarded-for header is only trusted if it contains a valid IP address.
 * Attackers cannot spoof IPs by injecting invalid values like "fake-ip" or "127.0.0.1, attacker".
 *
 * @param options - The extraction options
 * @returns The validated client IP address or null if none found
 */
export function extractClientIp(options: ExtractClientIpOptions): string | null {
  const { forwardedFor, directIp, remoteAddress } = options;

  // Try x-forwarded-for first (from trusted proxy)
  if (forwardedFor) {
    const headerValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

    if (headerValue) {
      // Take only the first (leftmost) IP, which is the original client
      const firstIp = headerValue.split(",")[0]?.trim();

      // Only use if it's a valid IP format
      if (firstIp && isValidIp(firstIp)) {
        return firstIp;
      }
      // If x-forwarded-for exists but contains invalid IP, fall through to alternatives
    }
  }

  // Try direct IP from request
  if (directIp) {
    const cleanIp = directIp.replace(/^::ffff:/, ""); // Handle IPv4-mapped IPv6
    if (isValidIp(cleanIp)) {
      return cleanIp;
    }
  }

  // Try connection remote address
  if (remoteAddress) {
    const cleanIp = remoteAddress.replace(/^::ffff:/, "");
    if (isValidIp(cleanIp)) {
      return cleanIp;
    }
  }

  return null;
}

/**
 * Extracts client IP from an Express-like request object.
 *
 * @param req - The request object with headers, ip, and connection properties
 * @returns The validated client IP address or null if none found
 */
export function extractClientIpFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
}): string | null {
  return extractClientIp({
    forwardedFor: req.headers?.["x-forwarded-for"],
    directIp: req.ip,
    remoteAddress: req.connection?.remoteAddress,
  });
}
