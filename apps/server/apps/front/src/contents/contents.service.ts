import { Injectable } from '@nestjs/common';
import {
  ContentListingState,
  ContentPublishStatus,
  Prisma,
  type Content,
} from '@prisma/client';
import {
  assertMemberUserRowExists,
  AuditAction,
  AuditLogService,
  PrismaService,
} from '@app/database';
import { assertUuidShapeOrNotFound, DomainHttpException } from '@app/http';
import { ContentPublishModerationService } from '../moderation/content-publish-moderation.service';

/** Owner 可改正文/标题的发布态（未进入「已发布」或审核队列中态）。 */
const OWNER_PATCHABLE_PUBLISH_STATUSES: ReadonlySet<ContentPublishStatus> =
  new Set([
    ContentPublishStatus.DRAFT,
    ContentPublishStatus.MACHINE_REJECTED,
    ContentPublishStatus.MANUALLY_REJECTED,
  ]);

/** 允许发起「提交发布」的源态；事务内先 `SUBMITTED` 再经 {@link ContentPublishModerationService} 入队机审（终态由 worker 异步写入）。 */
const OWNER_SUBMITTABLE_PUBLISH_STATUSES: ReadonlySet<ContentPublishStatus> =
  OWNER_PATCHABLE_PUBLISH_STATUSES;

/**
 * **输出 DTO**：单条内容的对外可读形状（`GET .../contents/:id` 与 PATCH/发布后返回同源字段）。
 * 时间为 ISO 字符串，避免 JSON 序列化分叉。
 */
export type ContentReadDto = {
  /** `contents.id`（UUID）。 */
  id: string;
  /** 标题；草稿等阶段可为 `null`。 */
  title: string | null;
  /** 正文 JSON（Prisma `Json` 与 C 端契约一致）。 */
  body: Content['body'];
  /** 发布状态机当前值（机审/人审异步推进）。 */
  publishStatus: ContentPublishStatus;
  /** 上架态（平台干预与访客可见性与此相关）。 */
  listingState: ContentListingState;
  /** 占位内容种类（权益占位链路等）。 */
  placeholderKind: Content['placeholderKind'];
  /** Owner 的 `MemberUser.id`；无 Owner 占位场景为 `null`。 */
  ownerMemberId: string | null;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 最后更新时间 ISO8601。 */
  updatedAt: string;
};

@Injectable()
export class ContentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publishModeration: ContentPublishModerationService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * 访客：**仅**「正常已发布」或「疑似已发布」且 `NORMAL` 上架态可读（PRD §6：疑似亦对访客可见）。
   * 会员： additionally 可读本人为 Owner 的任意发布/占位态（编辑前草稿等），与访客规则取并集。
   */
  async getByIdForViewer(
    contentId: string,
    viewerMemberId: string | undefined,
  ): Promise<ContentReadDto> {
    assertUuidShapeOrNotFound(contentId, '内容不存在或不可访问');

    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) {
      throw new DomainHttpException(
        404,
        'NOT_FOUND',
        '内容不存在或不可访问',
        {},
      );
    }

    const isOwner =
      viewerMemberId !== undefined &&
      content.ownerMemberId !== null &&
      content.ownerMemberId === viewerMemberId;
    const isPublicGuestReadable =
      (content.publishStatus === ContentPublishStatus.PUBLISHED ||
        content.publishStatus === ContentPublishStatus.SUSPICIOUS_PUBLISHED) &&
      content.listingState === ContentListingState.NORMAL;

    if (!isPublicGuestReadable && !isOwner) {
      throw new DomainHttpException(
        404,
        'NOT_FOUND',
        '内容不存在或不可访问',
        {},
      );
    }

    return this.toDto(content);
  }

  /**
   * Owner 更新标题/正文 JSON；**禁止**在已发布或审核中等态修改（与 PRD 草稿/退回后再编一致）。
   */
  async patchByOwner(params: {
    memberId: string;
    contentId: string;
    patch: { title?: string | null; body?: unknown };
  }): Promise<ContentReadDto> {
    const { memberId, contentId, patch } = params;
    await assertMemberUserRowExists(this.prisma, memberId);
    const content = await this.requireContentForOwnerWrite(memberId, contentId);
    if (!OWNER_PATCHABLE_PUBLISH_STATUSES.has(content.publishStatus)) {
      throw new DomainHttpException(
        409,
        'CONTENT_PATCH_FORBIDDEN_STATE',
        '当前状态不可编辑内容',
        { publishStatus: content.publishStatus },
      );
    }

    const data: Prisma.ContentUpdateInput = {};
    if (patch.title !== undefined) {
      data.title = patch.title;
    }
    if (patch.body !== undefined) {
      data.body = patch.body as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data,
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_OWNER_PATCH,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fields: {
            title: patch.title !== undefined,
            body: patch.body !== undefined,
          },
        },
      });
      return row;
    });
    return this.toDto(updated);
  }

  /**
   * Owner 提交发布：自草稿/退回态进入 **`SUBMITTED`**，并写入 **`QUEUED`** 的 `ModerationJob`；
   * **`PUBLISHED`** 由机审 worker（`ContentModerationProcessorService`）异步消费后落库。
   */
  async submitPublishByOwner(params: {
    memberId: string;
    contentId: string;
  }): Promise<ContentReadDto> {
    const { memberId, contentId } = params;
    await assertMemberUserRowExists(this.prisma, memberId);
    const content = await this.requireContentForOwnerWrite(memberId, contentId);
    if (!OWNER_SUBMITTABLE_PUBLISH_STATUSES.has(content.publishStatus)) {
      throw new DomainHttpException(
        409,
        'CONTENT_SUBMIT_PUBLISH_FORBIDDEN_STATE',
        '当前状态不可提交发布',
        { publishStatus: content.publishStatus },
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.content.update({
        where: { id: content.id },
        data: { publishStatus: ContentPublishStatus.SUBMITTED },
      });
      await this.publishModeration.enqueuePublishJob(tx, content.id);
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_OWNER_SUBMIT_PUBLISH,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromPublishStatus: content.publishStatus,
          toPublishStatus: ContentPublishStatus.SUBMITTED,
          moderation: 'async_queued',
        },
      });
      return tx.content.findUniqueOrThrow({ where: { id: content.id } });
    });
    return this.toDto(updated);
  }

  /** 写路径：须存在且 `ownerMemberId` 与当前会员一致。 */
  private async requireContentForOwnerWrite(
    memberId: string,
    contentId: string,
  ): Promise<Content> {
    assertUuidShapeOrNotFound(contentId, '内容不存在或不可访问');
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) {
      throw new DomainHttpException(
        404,
        'NOT_FOUND',
        '内容不存在或不可访问',
        {},
      );
    }
    if (content.ownerMemberId === null || content.ownerMemberId !== memberId) {
      throw new DomainHttpException(
        403,
        'CONTENT_OWNER_ACTION_FORBIDDEN',
        '仅内容 Owner 可执行此操作',
        {},
      );
    }
    return content;
  }

  private toDto(content: Content): ContentReadDto {
    return {
      id: content.id,
      title: content.title,
      body: content.body,
      publishStatus: content.publishStatus,
      listingState: content.listingState,
      placeholderKind: content.placeholderKind,
      ownerMemberId: content.ownerMemberId,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
    };
  }
}
