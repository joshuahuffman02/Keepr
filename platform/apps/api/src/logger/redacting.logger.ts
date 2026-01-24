import { Injectable } from "@nestjs/common";
import { getRequestContext, getTraceFields } from "../common/request-context";

const redactEmail = (value: string) =>
  value.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, "[redacted_email]");
const redactPhone = (value: string) => value.replace(/\+?\d[\d\s().-]{7,}\b/g, "[redacted_phone]");
const redactCardLast4 = (value: string) =>
  value.replace(/last4["']?\s*:\s*["']?\d{4}["']?/gi, 'last4:"[redacted_last4]"');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const redact = (value: unknown, keyHint?: string): unknown => {
  if (typeof value === "string") {
    if (keyHint === "last4") return "[redacted_last4]";
    return redactCardLast4(redactPhone(redactEmail(value)));
  }
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
};

const getLogContext = (): Record<string, string> | null => {
  const store = getRequestContext();
  if (!store) return null;

  const context: Record<string, string> = {};
  if (store.requestId) context.requestId = store.requestId;
  if (store.traceparent) {
    const { traceId, spanId } = getTraceFields(store.traceparent);
    if (traceId) context.traceId = traceId;
    if (spanId) context.spanId = spanId;
  }

  return Object.keys(context).length ? context : null;
};

@Injectable()
export class RedactingLogger {
  log(message?: unknown, ...optionalParams: unknown[]): void {
    const context = getLogContext();
    const payload = context ? [...optionalParams, context] : optionalParams;
    console.log(redact(message), ...payload.map((value) => redact(value)));
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    const context = getLogContext();
    const payload = context ? [...optionalParams, context] : optionalParams;
    console.error(redact(message), ...payload.map((value) => redact(value)));
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    const context = getLogContext();
    const payload = context ? [...optionalParams, context] : optionalParams;
    console.warn(redact(message), ...payload.map((value) => redact(value)));
  }
  debug?(message: unknown, ...optionalParams: unknown[]): void {
    const context = getLogContext();
    const payload = context ? [...optionalParams, context] : optionalParams;
    console.debug(redact(message), ...payload.map((value) => redact(value)));
  }
  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    const context = getLogContext();
    const payload = context ? [...optionalParams, context] : optionalParams;
    console.debug(redact(message), ...payload.map((value) => redact(value)));
  }
}
