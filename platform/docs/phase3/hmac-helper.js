#!/usr/bin/env node
/**
 * Compute X-Signature for webhook calls.
 * Usage: node hmac-helper.js "<secret>" "<timestamp>" "<path>" "<body>"
 * Example:
 *   node hmac-helper.js secret "2025-05-12T18:34:00Z" "/webhooks/channel/booking.com/availability" '{"foo":"bar"}'
 */
import crypto from "crypto";

function main() {
  const [secret, timestamp, path, body] = process.argv.slice(2);
  if (!secret || !timestamp || !path || body === undefined) {
    console.error('Usage: node hmac-helper.js "<secret>" "<timestamp>" "<path>" "<body>"');
    process.exit(1);
  }
  const payload = `${timestamp}\n${path}\n${body}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  console.log(sig);
}

main();
