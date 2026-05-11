import { prismaSkipTake } from '@app/http';
import type { ContentTransfer, PrismaClient } from '@prisma/client';

type ContentTransferDb = Pick<PrismaClient, '$transaction' | 'contentTransfer'>;

/**
 * 按 **`contentId`** 分页列出转让单（**`createdAt` desc**）；供 C 端 Owner 列表与管理端只读列表复用。
 */
export async function findContentTransfersPageByContentId(
  db: ContentTransferDb,
  contentId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: ContentTransfer[]; total: number }> {
  const { skip, take } = prismaSkipTake(page, pageSize);
  const where = { contentId };
  const [total, rows] = await db.$transaction([
    db.contentTransfer.count({ where }),
    db.contentTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);
  return { total, rows };
}

/** 将转让单时间与枚举字段序列化为 API DTO 常用 ISO 字符串形态。 */
export function contentTransferCoreTimestampsToDto(
  row: Pick<
    ContentTransfer,
    | 'method'
    | 'status'
    | 'expiresAt'
    | 'createdAt'
    | 'confirmedAt'
    | 'revokedAt'
  >,
): {
  method: ContentTransfer['method'];
  status: ContentTransfer['status'];
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  revokedAt: string | null;
} {
  return {
    method: row.method,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}
