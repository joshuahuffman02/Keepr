import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (!endpoint) {
  throw new Error("OTEL_EXPORTER_OTLP_ENDPOINT is required for web OTel tracing.");
}

const serviceName = process.env.OTEL_SERVICE_NAME || "keepr-web";

registerOTel({
  serviceName,
  traceExporter: new OTLPTraceExporter({ url: endpoint }),
  attributes: {
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  },
});
