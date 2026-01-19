import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const enabled =
  (process.env.OTEL_ENABLED ?? "").toLowerCase() === "true" ||
  !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (enabled) {
  const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!exporterUrl) {
    // eslint-disable-next-line no-console
    console.warn("OTEL_ENABLED is true but OTEL_EXPORTER_OTLP_ENDPOINT is not set; skipping OTel setup.");
  } else {
    const serviceName = process.env.OTEL_SERVICE_NAME || "keepr-api";
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
      traceExporter: new OTLPTraceExporter({ url: exporterUrl }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    Promise.resolve(sdk.start()).catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.warn(`OTel initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`OTel shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}
