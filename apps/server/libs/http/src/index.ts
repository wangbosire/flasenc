/**
 * `@app/http` 库导出入口：信封、异常、JWT 辅助、Zod 分页、Swagger 初始化、探活等。
 * 子应用通过 `imports: [HttpCoreModule]` 挂载横切能力；类型与工具从此 barrel 引用即可。
 */
export * from './api-exception.filter';
export * from './bearer-authorization';
export * from './domain-http.exception';
export * from './domain-zod-validation.pipe';
export * from './health-probe.controller';
export * from './http-core.module';
export * from './http-envelope.types';
export * from './jwt-access.constants';
export * from './jwt-subject';
export * from './offset-page-query.dto';
export * from './offset-page-query.schema';
export * from './request-trace.middleware';
export * from './response-envelope.interceptor';
export * from './setup-http-swagger';
export * from './uuid';
export * from './uuid-zod.schema';
export * from './zod-body.pipe';
export * from './zod-query.pipe';
