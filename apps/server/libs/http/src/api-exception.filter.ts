import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { DomainHttpException } from './domain-http.exception';
import { readRequestTraceId } from '@app/shared';

/**
 * 全局异常过滤器：把任意 `throw` 转成 HTTP JSON，且 **`traceId` / `X-Request-Id`** 与中间件、成功信封对齐。
 *
 * **分支策略**（按顺序短路）：
 * 1. {@link DomainHttpException}：业务/校验已决策好的 **status + errorCode + details**，原样写入 `error`。
 * 2. Nest **`HttpException`**：多为框架或第三方；**401** 映射为 `AUTH_UNAUTHORIZED`，其余暂用 `BAD_REQUEST`（可随规范细化）。
 * 3. 其它未知错误：**500** + `INTERNAL_ERROR`，**不向客户端输出堆栈**（防信息泄漏）。
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    /** 优先复用请求上的 trace；否则读入站 `X-Request-Id`；再没有则新生成，保证响应必有追踪 id。 */
    const traceId =
      readRequestTraceId(req) ||
      (typeof req.headers['x-request-id'] === 'string' &&
        req.headers['x-request-id'].trim()) ||
      randomUUID();
    res.setHeader('X-Request-Id', traceId);

    if (exception instanceof DomainHttpException) {
      res.status(exception.status).json({
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details,
        },
        traceId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' &&
              payload !== null &&
              'message' in payload
            ? String(payload.message)
            : exception.message;
      res.status(status).json({
        success: false,
        error: {
          code: status === 401 ? 'AUTH_UNAUTHORIZED' : 'BAD_REQUEST',
          message,
          details: {},
        },
        traceId,
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务暂时不可用，请稍后重试',
        details: {},
      },
      traceId,
    });
  }
}
