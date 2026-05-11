import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { readRequestTraceId } from '@app/shared';

/**
 * 成功响应拦截器：在 Controller 返回值外包一层 **`{ success: true, data, traceId }`**（与 HTTP API 规范成功信封一致）。
 *
 * **`data` 为 `null` 的情况**：若 handler 返回 `undefined`（例如无 `@Res()` 且方法无显式 return），此处将 `data` 置为 **`null`**，
 * 避免 JSON 里出现 `data` 键缺失导致客户端解析分叉。
 *
 * **`headersSent`**：若下游已直接写响应（如文件流、重定向），则不再包信封，原样透传。
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const traceId =
      readRequestTraceId(req) ||
      (typeof req.headers['x-request-id'] === 'string' &&
        req.headers['x-request-id'].trim()) ||
      randomUUID();
    res.setHeader('X-Request-Id', traceId);

    return next.handle().pipe(
      map((body: unknown) => {
        if (res.headersSent) {
          return body;
        }
        return {
          success: true as const,
          data: body === undefined ? null : body,
          traceId,
        };
      }),
    );
  }
}
