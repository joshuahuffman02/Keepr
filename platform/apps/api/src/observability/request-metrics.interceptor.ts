import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ObservabilityService } from "./observability.service";
import { performance } from "perf_hooks";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly observability: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const start = performance.now();
    const path = req?.originalUrl || req?.url || "unknown";
    const method = req?.method || "UNKNOWN";

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = performance.now() - start;
          this.observability.recordApiRequest({
            method,
            path,
            status: 200,
            durationMs,
          });
        },
        error: (err: unknown) => {
          const durationMs = performance.now() - start;
          const status = isRecord(err) && typeof err.status === "number" ? err.status : 500;
          this.observability.recordApiRequest({
            method,
            path,
            status,
            durationMs,
          });
        },
      }),
    );
  }
}
