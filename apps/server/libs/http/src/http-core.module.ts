import {
  Global,
  MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { DomainZodValidationPipe } from './domain-zod-validation.pipe';
import { HealthProbeController } from './health-probe.controller';
import { RequestTraceMiddleware } from './request-trace.middleware';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

/**
 * HTTP 横切能力模块：异常→规范信封、成功→规范信封、请求 trace、健康检查、全局 Zod 入参校验。
 *
 * **注册顺序要点**：`APP_FILTER` / `APP_INTERCEPTOR` / `APP_PIPE` 由 Nest 按内置顺序调用；
 * `DomainZodValidationPipe` 在到达 Controller 方法前解析 DTO；`RequestTraceMiddleware` 需早于 Guard
 * 以便 `req.traceId` 与响应头一致（见中间件 `configure`）。
 */
@Global()
@Module({
  controllers: [HealthProbeController],
  providers: [
    /** 兜底将 {@link DomainHttpException} / `HttpException` / 未知错误转为 JSON 失败体。 */
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    /** 2xx 响应包装为 `{ success, data, traceId }`。 */
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    /** 对 `createZodDto` 声明的 body/query 做 Zod 校验；见 {@link DomainZodValidationPipe}。 */
    { provide: APP_PIPE, useClass: DomainZodValidationPipe },
    RequestTraceMiddleware,
  ],
  exports: [],
})
export class HttpCoreModule implements NestModule {
  /** 全路由挂载 trace 中间件（在路由树匹配前执行）。 */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestTraceMiddleware).forRoutes('*');
  }
}
