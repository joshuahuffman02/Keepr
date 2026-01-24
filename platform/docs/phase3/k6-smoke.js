import http from "k6/http";
import { check, sleep } from "k6";

const base = __ENV.BASE_URL || "http://localhost:3000";
const idemKey1 = "00000000-0000-0000-0000-000000000001";
const idemKey2 = "00000000-0000-0000-0000-000000000002";
const signature = __ENV.SIGNATURE || "replace";
const timestamp = new Date().toISOString();

export const options = { vus: 1, iterations: 1 };

const headers = (key, version) => ({
  "Content-Type": "application/json",
  "Idempotency-Key": key,
  "X-Version": String(version),
  "X-Timestamp": timestamp,
  "X-Signature": signature,
});

export default function () {
  const payload = {
    parkId: "pk_123",
    unitTypeId: "ut_9",
    tz: "America/Denver",
    version: 1,
    dates: [{ date: "2025-06-01", inventory: 3 }],
  };

  const res = http.post(
    `${base}/webhooks/channel/booking.com/availability`,
    JSON.stringify(payload),
    { headers: headers(idemKey1, 1) },
  );
  check(res, { "availability 202": (r) => r.status === 202 });

  const res2 = http.post(
    `${base}/webhooks/channel/booking.com/availability`,
    JSON.stringify({ ...payload, version: 0 }),
    { headers: headers(idemKey2, 0) },
  );
  check(res2, { "stale 409": (r) => r.status === 409 });

  sleep(1);
}
