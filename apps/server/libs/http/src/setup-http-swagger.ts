import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/** `setupHttpSwagger` 可选配置：标题、描述、UI 路径。 */
export type SetupHttpSwaggerOptions = {
  /** OpenAPI `info.title`，区分 C 端 / 管理端文档。 */
  title: string;
  /** `info.description`；缺省时使用库内默认说明（信封 + Zod 同源）。 */
  description?: string;
  /**
   * Swagger UI 挂载路径（**不含** `setGlobalPrefix`）。
   * 例如 `docs` → 浏览器访问 `http://host:port/docs`，而业务 API 仍在 `/api/v1` 或 `/admin/v1`。
   */
  path?: string;
};

/**
 * 注册 Swagger UI 与 OpenAPI 文档。
 *
 * **启用条件**（满足其一即挂载）：
 * 1. `SWAGGER_ENABLED` 为 `true` / `1`（用于生产受控环境临时开文档）；
 * 2. 或 `NODE_ENV !== 'production'`（本地/预发默认开启）。
 *
 * **OpenAPI 后处理**：`SwaggerModule.createDocument` 生成初稿后必须再执行 **`cleanupOpenApiDoc`**（nestjs-zod），
 * 否则由 `createZodDto` 注入的 schema 元数据在文档里可能残缺（空 `type`、递归、`null` 语义等）。
 */
export function setupHttpSwagger(
  app: INestApplication,
  options: SetupHttpSwaggerOptions,
): void {
  const enabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    process.env.SWAGGER_ENABLED === '1' ||
    process.env.NODE_ENV !== 'production';
  if (!enabled) {
    return;
  }

  const path = options.path ?? 'docs';
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(
      options.description ??
        'HTTP 响应为统一信封（success/data 或 success/error）；业务码见 docs/api/http-api-specification.md。请求体与 query 的 OpenAPI 由 **nestjs-zod**（`createZodDto` + Zod schema）生成，与运行时校验同源。',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Bearer access token',
        in: 'header',
      },
      // 与 Controller 上 `ApiBearerAuth('bearer')` 的 scheme 名称一致
      'bearer',
    )
    .build();

  const rawDocument = SwaggerModule.createDocument(app, config);
  const document = cleanupOpenApiDoc(rawDocument);
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      /** 刷新页面后仍保留「Authorize」里填的 token，减少联调摩擦。 */
      persistAuthorization: true,
      /** UI 展示请求耗时，便于粗看接口快慢。 */
      displayRequestDuration: true,
    },
  });
}
