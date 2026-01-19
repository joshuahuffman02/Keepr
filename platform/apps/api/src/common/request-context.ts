import { AsyncLocalStorage } from "node:async_hooks";

type RequestContextStore = {
  requestId?: string;
  traceparent?: string;
  tracestate?: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext(store: RequestContextStore, callback: () => void): void {
  storage.run(store, callback);
}

export function getRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}

export function getRequestHeaders(): Record<string, string> {
  const store = storage.getStore();
  if (!store) return {};

  const headers: Record<string, string> = {};
  if (store.requestId) headers["x-request-id"] = store.requestId;
  if (store.traceparent) headers["traceparent"] = store.traceparent;
  if (store.tracestate) headers["tracestate"] = store.tracestate;
  return headers;
}

export function getTraceFields(traceparent?: string): { traceId?: string; spanId?: string } {
  if (!traceparent) return {};
  const parts = traceparent.split("-");
  if (parts.length < 4) return {};
  const traceId = parts[1];
  const spanId = parts[2];
  return {
    traceId: traceId || undefined,
    spanId: spanId || undefined,
  };
}
