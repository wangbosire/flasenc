import { Injectable } from '@nestjs/common';
import type { Comment, Prisma } from '@prisma/client';
import { CommentPublishStatus } from '@prisma/client';
import { AuditAction, AuditLogService, PrismaService } from '@app/database';
import {
  DomainHttpException,
  isUuidChar36,
  prismaSkipTakeFromOffsetQuery,
  type OffsetPageQuery,
} from '@app/http';
import { ContentsService } from '../contents/contents.service';

/** **Query DTO 别名**：与通用分页 `OffsetPageQuery` 一致，供评论列表入参类型复用。 */
export type ListCommentsQuery = OffsetPageQuery;

/**
 * **输出 DTO**：评论列表单行（不含软删行；`deletedAt` 在查询层过滤）。
 * `anchorId`/`parentId`/`replyToCommentId` 语义与设计文档「二层对话串」一致。
 */
export type CommentListItemDto = {
  /** `comments.id`。 */
  id: string;
  /** 所属内容 id。 */
  contentId: string;
  /** 作者 `MemberUser.id`。 */
  authorMemberId: string;
  /** 对话锚点根评论 id；顶层评论为 `null`。 */
  anchorId: string | null;
  /** 父评论 id；顶层为 `null`。 */
  parentId: string | null;
  /** 回复目标评论 id（二层串）；无指向时为 `null`。 */
  replyToCommentId: string | null;
  /** 正文 JSON。 */
  body: Comment['body'];
  /** 评论发布状态（审核/可见性）。 */
  publishStatus: CommentPublishStatus;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 更新时间 ISO8601。 */
  updatedAt: string;
};

/** **输出 DTO**：分页包装，与 HTTP 规范列表响应字段一致。 */
export type CommentListResultDto = {
  /** 当前页数据。 */
  items: CommentListItemDto[];
  /** 满足筛选条件的总行数（非仅本页条数）。 */
  total: number;
  /** 当前页码（从 1 起）。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentsService: ContentsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private toListItem(row: Comment): CommentListItemDto {
    return {
      id: row.id,
      contentId: row.contentId,
      authorMemberId: row.authorMemberId,
      anchorId: row.anchorId,
      parentId: row.parentId,
      replyToCommentId: row.replyToCommentId,
      body: row.body,
      publishStatus: row.publishStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listForViewer(
    contentId: string,
    viewerMemberId: string | undefined,
    query: ListCommentsQuery,
  ): Promise<CommentListResultDto> {
    await this.contentsService.getByIdForViewer(contentId, viewerMemberId);
    const { page, pageSize } = query;
    const { skip, take } = prismaSkipTakeFromOffsetQuery(query);
    const where: Prisma.CommentWhereInput = {
      contentId,
      deletedAt: null,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
    ]);
    return {
      items: rows.map((r) => this.toListItem(r)),
      total,
      page,
      pageSize,
    };
  }

  async createUnderContent(params: {
    contentId: string;
    memberId: string;
    body: unknown;
    anchorId?: string;
    replyToCommentId?: string;
  }): Promise<CommentListItemDto> {
    const { contentId, memberId } = params;
    await this.contentsService.getByIdForViewer(contentId, memberId);

    const hasAnchor = params.anchorId !== undefined;

    if (!hasAnchor) {
      if (params.replyToCommentId !== undefined) {
        throw new DomainHttpException(
          400,
          'COMMENT_ANCHOR_REQUIRED',
          '根评论不得带 replyToCommentId',
          {},
        );
      }
      const row = await this.prisma.$transaction(async (tx) => {
        const c = await tx.comment.create({
          data: {
            contentId,
            authorMemberId: memberId,
            anchorId: null,
            parentId: null,
            replyToCommentId: null,
            body: params.body as Prisma.InputJsonValue,
            publishStatus: CommentPublishStatus.PUBLISHED,
          },
        });
        await this.auditLog.append(tx, {
          actorMemberId: memberId,
          action: AuditAction.CONTENT_COMMENT_CREATE,
          targetType: 'Comment',
          targetId: c.id,
          payload: { contentId, anchor: true },
        });
        return c;
      });
      return this.toListItem(row);
    }

    if (!isUuidChar36(params.anchorId!)) {
      throw new DomainHttpException(
        400,
        'COMMENT_ANCHOR_INVALID',
        '锚点评论不存在或不属于该内容',
        {},
      );
    }

    const anchor = await this.prisma.comment.findFirst({
      where: {
        id: params.anchorId,
        contentId,
        deletedAt: null,
        anchorId: null,
      },
    });
    if (!anchor) {
      throw new DomainHttpException(
        400,
        'COMMENT_ANCHOR_INVALID',
        '锚点评论不存在或不属于该内容',
        {},
      );
    }

    if (params.replyToCommentId !== undefined) {
      if (!isUuidChar36(params.replyToCommentId)) {
        throw new DomainHttpException(
          400,
          'COMMENT_REPLY_TARGET_INVALID',
          '被回复的评论不存在或不在同一串内',
          {},
        );
      }
      const target = await this.prisma.comment.findFirst({
        where: {
          id: params.replyToCommentId,
          contentId,
          deletedAt: null,
        },
      });
      if (!target) {
        throw new DomainHttpException(
          400,
          'COMMENT_REPLY_TARGET_INVALID',
          '被回复的评论不存在或不在同一串内',
          {},
        );
      }
      const inThread = target.id === anchor.id || target.anchorId === anchor.id;
      if (!inThread) {
        throw new DomainHttpException(
          400,
          'COMMENT_REPLY_TARGET_INVALID',
          '被回复的评论不存在或不在同一串内',
          {},
        );
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          contentId,
          authorMemberId: memberId,
          anchorId: anchor.id,
          parentId: anchor.id,
          replyToCommentId: params.replyToCommentId ?? null,
          body: params.body as Prisma.InputJsonValue,
          publishStatus: CommentPublishStatus.PUBLISHED,
        },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_COMMENT_CREATE,
        targetType: 'Comment',
        targetId: c.id,
        payload: { contentId, anchorId: anchor.id },
      });
      return c;
    });
    return this.toListItem(row);
  }

  async softDeleteById(params: {
    memberId: string;
    commentId: string;
  }): Promise<void> {
    const { memberId, commentId } = params;
    if (!isUuidChar36(commentId)) {
      throw new DomainHttpException(404, 'NOT_FOUND', '评论不存在', {});
    }
    const row = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { content: true },
    });
    if (!row || row.deletedAt) {
      throw new DomainHttpException(404, 'NOT_FOUND', '评论不存在', {});
    }

    await this.contentsService.getByIdForViewer(row.contentId, memberId);

    const isAuthor = row.authorMemberId === memberId;
    const isOwner =
      row.content.ownerMemberId !== null &&
      row.content.ownerMemberId === memberId;
    if (!isAuthor && !isOwner) {
      throw new DomainHttpException(
        403,
        'CONTENT_COMMENT_DELETE_FORBIDDEN',
        '无权删除该评论',
        {},
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_COMMENT_DELETE,
        targetType: 'Comment',
        targetId: commentId,
        payload: {
          contentId: row.contentId,
          asOwner: isOwner && !isAuthor,
        },
      });
    });
  }
}
