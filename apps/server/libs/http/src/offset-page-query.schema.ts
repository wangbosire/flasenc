import { z } from 'zod';

/**
 * 通用「偏移分页」query：与 `docs/api/http-api-specification.md` 列表约定一致。
 *
 * - **`page`**：从 1 开始；`z.coerce` 兼容 query 字符串。
 * - **`pageSize`**：默认 20，最大 100，防止单次拉取过大压垮 DB。
 */
export const offsetPageQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('页码，从 1 起；query 字符串会强制转为数字。'),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('每页条数，默认 20，最大 100。'),
});

/** `offsetPageQuerySchema` 解析后的 TypeScript 类型。 */
export type OffsetPageQuery = z.infer<typeof offsetPageQuerySchema>;

/**
 * 将人类分页参数转为 Prisma **`skip` / `take`**。
 * 公式：`skip = (page - 1) * pageSize`，与常见 offset 分页一致。
 */
export function prismaSkipTake(
  page: number,
  pageSize: number,
): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** 从已校验的 {@link OffsetPageQuery}（或 `.extend` 后的超集）直接取 `skip`/`take`。 */
export function prismaSkipTakeFromOffsetQuery(query: OffsetPageQuery): {
  skip: number;
  take: number;
} {
  return prismaSkipTake(query.page, query.pageSize);
}
