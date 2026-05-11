import type { Request } from 'express';

/** 与 HTTP 中间件写入的字段名一致，供拦截器、审计等读取。 */
export type RequestWithTraceId = Request & { traceId?: string };

export function readRequestTraceId(req: Request): string | undefined {
  const v = (req as RequestWithTraceId).traceId;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export function assignRequestTraceId(req: Request, traceId: string): void {
  (req as RequestWithTraceId).traceId = traceId;
}
