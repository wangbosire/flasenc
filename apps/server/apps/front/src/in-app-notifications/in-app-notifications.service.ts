import { Injectable } from '@nestjs/common';
import type { InAppNotification, Prisma } from '@prisma/client';
import { assertMemberUserEmailPresent, PrismaService } from '@app/database';
import {
  DomainHttpException,
  assertUuidShapeOrNotFound,
  offsetPageQuerySchema,
  prismaSkipTakeFromOffsetQuery,
} from '@app/http';
import { z } from 'zod';

export const listInAppNotificationsQuerySchema = offsetPageQuerySchema.extend({
  onlyUnread: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .describe(
      '缺省或 `false`/`0`：列出全部；`true`/`1`：仅 `readAt` 为空的未读行。',
    ),
});

/** **Query DTO**：站内信列表（分页 + 可选仅未读），由 `listInAppNotificationsQuerySchema` 推断。 */
export type ListInAppNotificationsQuery = z.infer<
  typeof listInAppNotificationsQuerySchema
>;

/** **输出 DTO**：单条站内信（列表项与「标记已读」响应共用形状）。 */
export type InAppNotificationItemDto = {
  /** `in_app_notifications.id`。 */
  id: string;
  /** 业务分类（与投递侧常量对齐的字符串）。 */
  category: string;
  /** 标题纯文本。 */
  title: string;
  /** 正文纯文本。 */
  body: string;
  /** 扩展 JSON；无附加数据时为 `null`。 */
  data: InAppNotification['data'];
  /** 已读时间 ISO8601；未读为 `null`。 */
  readAt: string | null;
  /** 创建时间 ISO8601。 */
  createdAt: string;
};

/** **输出 DTO**：站内信分页列表。 */
export type InAppNotificationListResultDto = {
  /** 当前页通知。 */
  items: InAppNotificationItemDto[];
  /** 命中当前筛选（含仅未读）的总行数。 */
  total: number;
  /** 当前页码。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

@Injectable()
export class InAppNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toItemDto(row: InAppNotification): InAppNotificationItemDto {
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      data: row.data ?? null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(
    memberId: string,
    query: ListInAppNotificationsQuery,
  ): Promise<InAppNotificationListResultDto> {
    await assertMemberUserEmailPresent(this.prisma, memberId);
    const { page, pageSize } = query;
    const onlyUnread =
      query.onlyUnread === undefined
        ? false
        : query.onlyUnread === 'true' || query.onlyUnread === '1';
    const { skip, take } = prismaSkipTakeFromOffsetQuery(query);
    const where: Prisma.InAppNotificationWhereInput = {
      memberId,
      ...(onlyUnread ? { readAt: null } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inAppNotification.count({ where }),
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return {
      items: rows.map((r) => this.toItemDto(r)),
      total,
      page,
      pageSize,
    };
  }

  async markRead(
    memberId: string,
    notificationId: string,
  ): Promise<InAppNotificationItemDto> {
    await assertMemberUserEmailPresent(this.prisma, memberId);
    assertUuidShapeOrNotFound(notificationId, '通知不存在');
    const row = await this.prisma.inAppNotification.findUnique({
      where: { id: notificationId },
    });
    if (!row || row.memberId !== memberId) {
      throw new DomainHttpException(404, 'NOT_FOUND', '通知不存在', {});
    }
    if (row.readAt) {
      return this.toItemDto(row);
    }
    const updated = await this.prisma.inAppNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return this.toItemDto(updated);
  }
}
