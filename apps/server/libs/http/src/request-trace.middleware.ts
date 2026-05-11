import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { assignRequestTraceId } from '@app/shared';

/**
 * 请求追踪中间件：尽早确定 **`traceId`**，供后续 Guard、Service、审计、`ApiExceptionFilter` 共用同一标识。
 *
 * **优先级**：若客户端传入非空 **`X-Request-Id`**，则尊重该值（便于网关串联）；否则服务端生成 UUID。
 * 写入 **`req`**（通过 `assignRequestTraceId`）与响应头 **`X-Request-Id`**，与成功/失败信封里的 `traceId` 对齐。
 */
@Injectable()
export class RequestTraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['x-request-id'];
    const traceId =
      typeof header === 'string' && header.trim().length > 0
        ? header.trim()
        : randomUUID();
    assignRequestTraceId(req, traceId);
    res.setHeader('X-Request-Id', traceId);
    next();
  }
}
