import http from "k6/http";
import { check, sleep } from "k6";

const apiBase = __ENV.API_BASE || "http://localhost:4000/api";
const campgroundId = __ENV.CAMPGROUND_ID || "ckx0000000000000000000000";
const staffToken = __ENV.STAFF_TOKEN;

export const options = {
  stages: [
    { duration: "2m", target: 10 },
    { duration: "5m", target: 50 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

const jsonHeaders = (extra) => ({
  "Content-Type": "application/json",
  ...extra,
});

export default function () {
  const publicPayload = {
    sessionId: `public_${__VU}_${__ITER}`,
    message: "What does this weekend look like for arrivals?",
  };

  const publicRes = http.post(
    `${apiBase}/ai/public/campgrounds/${campgroundId}/chat`,
    JSON.stringify(publicPayload),
    { headers: jsonHeaders() },
  );
  check(publicRes, { "public chat 200": (r) => r.status === 200 });

  if (staffToken) {
    const staffPayload = {
      sessionId: `staff_${__VU}_${__ITER}`,
      message: "Show today KPI snapshot.",
      visibility: "public",
    };
    const staffRes = http.post(
      `${apiBase}/chat/campgrounds/${campgroundId}/message`,
      JSON.stringify(staffPayload),
      { headers: jsonHeaders({ Authorization: `Bearer ${staffToken}` }) },
    );
    check(staffRes, { "staff chat 200": (r) => r.status === 200 });
  }

  sleep(1);
}
