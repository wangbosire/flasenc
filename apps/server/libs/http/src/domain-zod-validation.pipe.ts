import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { DomainHttpException } from './domain-http.exception';

/**
 * 全局校验管道：对标记为 **nestjs-zod DTO** 的 `@Body()` / `@Query()` 等入参执行 **Zod `.parse`**。
 *
 * **为何 `strictSchemaDeclaration: false`**：大量路由仍使用原始 `@Param('id') string` 等，若设为 `true`，
 * 未声明为 Zod DTO 的参数会触发 `ZodSchemaDeclarationException`，与现有写法不兼容。
 *
 * **与 OpenAPI 的关系**：DTO 须由 **`createZodDto(schema)`** 生成；`setupHttpSwagger` 内对 OpenAPI 文档调用
 * **`cleanupOpenApiDoc`** 后，Swagger 才能从同一套 Zod schema 生成请求体/query 文档。
 *
 * **错误契约**：与历史 {@link ZodBodyPipe} / {@link ZodQueryPipe} 对齐——**422**、`error.code === 'VALIDATION_FAILED'`、
 * `error.details.fields` 为 **`ZodError.flatten().fieldErrors`**（便于前端按字段展示）。
 */
export const DomainZodValidationPipe = createZodValidationPipe({
  /** 见类注释：允许非 Zod DTO 的参数原样通过（由 Guard / 业务层处理）。 */
  strictSchemaDeclaration: false,
  /**
   * Zod 校验失败时统一转为 {@link DomainHttpException}，由 {@link ApiExceptionFilter} 写入规范失败信封。
   * 非 `ZodError` 时仍返回同一 code，避免管道内部泄漏未知结构。
   */
  createValidationException: (error) => {
    const fields = error instanceof ZodError ? error.flatten().fieldErrors : {};
    return new DomainHttpException(
      422,
      'VALIDATION_FAILED',
      '请求参数校验失败',
      { fields },
    );
  },
});
