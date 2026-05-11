import { createZodDto } from 'nestjs-zod';
import { offsetPageQuerySchema } from './offset-page-query.schema';

/**
 * **数据传输对象（DTO）**：列表接口通用分页 query。
 *
 * 与 {@link offsetPageQuerySchema} 完全同源；用于 **`@Query() query: OffsetPageQueryDto`**，
 * 经全局 {@link DomainZodValidationPipe} 校验后得到 `page` / `pageSize`，并供 Swagger 生成 OpenAPI。
 */
export class OffsetPageQueryDto extends createZodDto(offsetPageQuerySchema) {}
