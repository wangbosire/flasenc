import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { DomainHttpException } from './domain-http.exception';

/**
 * 在**单个参数**上使用的 body 校验管道（显式 `new ZodBodyPipe(schema)`）。
 *
 * **推荐路径**：`createZodDto` + 全局 {@link DomainZodValidationPipe}，以便 Swagger 与校验共用 schema。
 * 本类保留用于单测、或尚未迁到 DTO 的遗留入口。
 */
@Injectable()
export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  /**
   * 对原始 body 执行 `safeParse`；失败时抛出 {@link DomainHttpException}（422 + `VALIDATION_FAILED`）。
   * 成功则返回解析后的**窄类型**对象，避免 Service 收到未校验结构。
   */
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainHttpException(
        422,
        'VALIDATION_FAILED',
        '请求参数校验失败',
        {
          fields: parsed.error.flatten().fieldErrors,
        },
      );
    }
    return parsed.data;
  }
}
