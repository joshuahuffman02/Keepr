// @ts-nocheck
import { ObservabilityService } from "../observability/observability.service";

describe("Observability alerts", () => {
  it("flags SMS failure rate, offer lag, OTA backlog, and DLQ depth", () => {
    const obs = new ObservabilityService();

    // Simulate SMS failures
    obs.recordCommsStatus("failed", { provider: "twilio" });
    obs.recordCommsStatus("failed", { provider: "twilio" });
    obs.recordCommsStatus("failed", { provider: "twilio" });

    // Offer lag over threshold (seconds)
    obs.recordOfferLag(400, { entryId: "w1" });

    // OTA backlog over threshold (value is seconds of backlog)
    obs.recordOtaStatus(false, 1200, { provider: "Hipcamp" });

    // DLQ depth breach
    obs.setQueueState("jobs-dlq", 0, 5, 10000);

    const alerts = obs.alerts();

    expect(alerts.comms.breaches.smsFailures).toBe(true);
    expect(alerts.domain.offerLag.breach).toBe(true);
    expect(alerts.ota.backlogBreaches.length).toBeGreaterThan(0);
    expect(alerts.queues.depthBreaches.some((q) => q.name.includes("dlq"))).toBe(true);
  });
});
