import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { DomainHttpException } from './domain-http.exception';

/**
 * 在**单个参数**上使用的 query 校验管道；语义与 {@link ZodBodyPipe} 对称。
 *
 * **空 query**：Nest 传入的 `value` 可能为 `undefined`，此处归一为 `{}` 再 parse，避免 `z.object` 缺字段默认值不生效。
 * **推荐路径**：列表等场景使用 {@link OffsetPageQueryDto} 或自建 `createZodDto` + 全局管道。
 */
@Injectable()
export class ZodQueryPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  /** 将 query 对象 safeParse 为 `T`；失败时 422 + 字段错误（文案区分 query 便于排障）。 */
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(
      value !== undefined && value !== null && typeof value === 'object'
        ? value
        : {},
    );
    if (!parsed.success) {
      throw new DomainHttpException(
        422,
        'VALIDATION_FAILED',
        '查询参数校验失败',
        {
          fields: parsed.error.flatten().fieldErrors,
        },
      );
    }
    return parsed.data;
  }
}
