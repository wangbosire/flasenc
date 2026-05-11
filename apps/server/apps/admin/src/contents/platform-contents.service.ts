import { Injectable } from '@nestjs/common';
import {
  ContentListingState,
  ContentPublishStatus,
  type Content,
  TransferMethod,
  TransferStatus,
} from '@prisma/client';
import {
  AuditAction,
  AuditLogService,
  contentTransferCoreTimestampsToDto,
  findContentTransfersPageByContentId,
  PrismaService,
} from '@app/database';
import {
  assertUuidShapeOrNotFound,
  DomainHttpException,
  prismaSkipTake,
} from '@app/http';

/** 允许执行「下架 / 紧急隐藏」的内容发布态（PRD：针对已对外发布或疑似已发布内容）。 */
const LISTING_INTERVENTION_PUBLISH_STATUSES: ReadonlySet<ContentPublishStatus> =
  new Set([
    ContentPublishStatus.PUBLISHED,
    ContentPublishStatus.SUSPICIOUS_PUBLISHED,
  ]);

/**
 * **输出 DTO**：平台处置上架态类接口的精简回包（仅 id + 两态，便于列表/按钮刷新）。
 */
export type PlatformContentListingDto = {
  /** `contents.id`。 */
  id: string;
  /** 当前发布状态。 */
  publishStatus: ContentPublishStatus;
  /** 当前上架态（访客可见性依赖此字段）。 */
  listingState: ContentListingState;
};

/**
 * **输出 DTO**：管理端「疑似已发布」队列单行（PRD：先进队列再人工处置）。
 */
export type SuspiciousPublishedQueueItemDto = {
  /** 内容 id。 */
  id: string;
  /** 列表展示用标题。 */
  title: string | null;
  /** 队列内一般为 `SUSPICIOUS_PUBLISHED`（以库为准）。 */
  publishStatus: ContentPublishStatus;
  /** 上架态快照。 */
  listingState: ContentListingState;
  /** Owner `MemberUser.id`；无 Owner 为 `null`。 */
  ownerMemberId: string | null;
  /** 与 {@link PlatformContentAdminDetailDto.entitlementId} 同源，列表页即可跳转权益。 */
  entitlementId: string | null;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 更新时间 ISO8601。 */
  updatedAt: string;
};

/** **输出 DTO**：疑似已发布队列分页列表。 */
export type SuspiciousPublishedQueueResultDto = {
  /** 当前页队列行。 */
  items: SuspiciousPublishedQueueItemDto[];
  /** 命中筛选的总行数。 */
  total: number;
  /** 当前页码（从 1 起）。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

/**
 * **输出 DTO**：管理端内容详情（含正文 JSON；**不**经 C 端访客/Owner 可见性规则过滤）。
 */
export type PlatformContentAdminDetailDto = {
  /** `contents.id`。 */
  id: string;
  /** 标题。 */
  title: string | null;
  /** 正文 JSON（管理端全量可读）。 */
  body: Content['body'];
  /** 发布状态。 */
  publishStatus: ContentPublishStatus;
  /** 上架态。 */
  listingState: ContentListingState;
  /** 占位种类。 */
  placeholderKind: Content['placeholderKind'];
  /** Owner `MemberUser.id`。 */
  ownerMemberId: string | null;
  /** 与 `Content` 1:1 的权益行 id；无权益占位链路时为 `null`。 */
  entitlementId: string | null;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 更新时间 ISO8601。 */
  updatedAt: string;
};

/**
 * **输出 DTO**：管理端按内容分页查询转让单行；**不含**明文码或卡片 token。
 */
export type AdminContentTransferRecordDto = {
  /** 转让单 id。 */
  id: string;
  /** 被转让内容 id。 */
  contentId: string;
  /** 转出方 `MemberUser.id`。 */
  fromMemberId: string;
  /** 受让方 id；未完成确认为 `null`。 */
  toMemberId: string | null;
  /** 转让方式。 */
  method: TransferMethod;
  /** 转让单状态。 */
  status: TransferStatus;
  /** 凭证过期时间 ISO8601。 */
  expiresAt: string;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 确认完成时间。 */
  confirmedAt: string | null;
  /** 撤销时间。 */
  revokedAt: string | null;
};

/** **输出 DTO**：某内容下转让记录分页结果。 */
export type AdminContentTransferRecordsResultDto = {
  /** 当前页记录。 */
  items: AdminContentTransferRecordDto[];
  /** 总记录数。 */
  total: number;
  /** 当前页码（从 1 起）。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

@Injectable()
export class PlatformContentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * 平台按 **`contentId`** 只读列出 **`content_transfers`**（含 **`fromMemberId`/`toMemberId`**，便于客服对账）；
   * 内容不存在或 id 非法时与 {@link getDetailForPlatform} 一致 **404**。
   */
  async listTransferRecordsForAdmin(
    contentId: string,
    params: { page: number; pageSize: number },
  ): Promise<AdminContentTransferRecordsResultDto> {
    await this.loadContentOrThrow404(contentId);
    const { page, pageSize } = params;
    const { total, rows } = await findContentTransfersPageByContentId(
      this.prisma,
      contentId,
      page,
      pageSize,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        contentId: r.contentId,
        fromMemberId: r.fromMemberId,
        toMemberId: r.toMemberId,
        ...contentTransferCoreTimestampsToDto(r),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** `platformAdmin` 复核用：任意存在行可读；非法 id 形态与不存在均 **404**。 */
  async getDetailForPlatform(
    contentId: string,
  ): Promise<PlatformContentAdminDetailDto> {
    const content = await this.loadContentOrThrow404(contentId);
    const entitlement = await this.prisma.contentEntitlement.findUnique({
      where: { contentId: content.id },
      select: { id: true },
    });
    return {
      id: content.id,
      title: content.title,
      body: content.body,
      publishStatus: content.publishStatus,
      listingState: content.listingState,
      placeholderKind: content.placeholderKind,
      ownerMemberId: content.ownerMemberId,
      entitlementId: entitlement?.id ?? null,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
    };
  }

  /**
   * 分页列出 **`publishStatus=SUSPICIOUS_PUBLISHED`** 的内容（不限 `listingState`，含已下架/隐藏的疑似项以便运营排查）。
   */
  async listSuspiciousPublishedQueue(params: {
    page: number;
    pageSize: number;
  }): Promise<SuspiciousPublishedQueueResultDto> {
    const { page, pageSize } = params;
    const { skip, take } = prismaSkipTake(page, pageSize);
    const where = { publishStatus: ContentPublishStatus.SUSPICIOUS_PUBLISHED };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          title: true,
          publishStatus: true,
          listingState: true,
          ownerMemberId: true,
          createdAt: true,
          updatedAt: true,
          entitlement: { select: { id: true } },
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        publishStatus: r.publishStatus,
        listingState: r.listingState,
        ownerMemberId: r.ownerMemberId,
        entitlementId: r.entitlement?.id ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 无条件下架：访客不可再按公开路径阅读（与 C 端 `GET` 的 `NORMAL` 条件一致）。 */
  async setPlatformUnlisted(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    return this.applyListingIntervention(contentId, actorUserId, {
      target: ContentListingState.PLATFORM_UNLISTED,
      verb: 'unlist',
      auditAction: AuditAction.PLATFORM_CONTENT_UNLIST,
    });
  }

  /** 紧急隐藏：访客不可见；与下架正交，语义见 PRD / 技术方案。 */
  async setEmergencyHidden(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    return this.applyListingIntervention(contentId, actorUserId, {
      target: ContentListingState.EMERGENCY_HIDDEN,
      verb: 'hide',
      auditAction: AuditAction.PLATFORM_CONTENT_HIDE,
    });
  }

  /**
   * 恢复公开上架态为 **`NORMAL`**（撤销下架或紧急隐藏之一）。
   * 已为 `NORMAL` 时 **幂等** 直接返回（不写审计，避免重复刷屏）。
   */
  async restorePublicListing(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    const content = await this.loadContentOrThrow404(contentId);
    if (content.listingState === ContentListingState.NORMAL) {
      return this.toListingDto(content);
    }
    if (
      content.listingState !== ContentListingState.PLATFORM_UNLISTED &&
      content.listingState !== ContentListingState.EMERGENCY_HIDDEN
    ) {
      throw new DomainHttpException(
        409,
        'CONTENT_PLATFORM_RESTORE_NOT_APPLICABLE',
        '当前上架态无需恢复',
        { listingState: content.listingState },
      );
    }
    const from = content.listingState;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data: { listingState: ContentListingState.NORMAL },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.PLATFORM_CONTENT_RESTORE_LISTING,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromListingState: from,
          toListingState: ContentListingState.NORMAL,
        },
      });
      return row;
    });
    return this.toListingDto(updated);
  }

  /**
   * 人工消除「疑似」标记：仅 **`SUSPICIOUS_PUBLISHED`** → **`PUBLISHED`**；`listingState` 不变。
   */
  async clearSuspicion(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    const content = await this.loadContentOrThrow404(contentId);
    if (content.publishStatus !== ContentPublishStatus.SUSPICIOUS_PUBLISHED) {
      throw new DomainHttpException(
        409,
        'CONTENT_PLATFORM_SUSPICION_RESOLUTION_INVALID_STATE',
        '仅可对疑似已发布内容消除疑似标记',
        { publishStatus: content.publishStatus },
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data: { publishStatus: ContentPublishStatus.PUBLISHED },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.PLATFORM_CONTENT_SUSPICION_CLEARED,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromPublishStatus: content.publishStatus,
          toPublishStatus: ContentPublishStatus.PUBLISHED,
        },
      });
      return row;
    });
    return this.toListingDto(updated);
  }

  /**
   * 人工标记内容审核不通过：仅 **`SUSPICIOUS_PUBLISHED`** → **`MANUALLY_REJECTED`**；`listingState` 不变。
   */
  async markManuallyRejectedFromSuspicion(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    const content = await this.loadContentOrThrow404(contentId);
    if (content.publishStatus !== ContentPublishStatus.SUSPICIOUS_PUBLISHED) {
      throw new DomainHttpException(
        409,
        'CONTENT_PLATFORM_SUSPICION_RESOLUTION_INVALID_STATE',
        '仅可对疑似已发布内容执行人工标记失败',
        { publishStatus: content.publishStatus },
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data: { publishStatus: ContentPublishStatus.MANUALLY_REJECTED },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.PLATFORM_CONTENT_MANUAL_REJECT,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromPublishStatus: content.publishStatus,
          toPublishStatus: ContentPublishStatus.MANUALLY_REJECTED,
        },
      });
      return row;
    });
    return this.toListingDto(updated);
  }

  private async applyListingIntervention(
    contentId: string,
    actorUserId: string,
    opts: {
      target: ContentListingState;
      verb: 'unlist' | 'hide';
      auditAction: string;
    },
  ): Promise<PlatformContentListingDto> {
    const content = await this.loadContentOrThrow404(contentId);
    if (!LISTING_INTERVENTION_PUBLISH_STATUSES.has(content.publishStatus)) {
      throw new DomainHttpException(
        409,
        'CONTENT_PLATFORM_LISTING_ACTION_INVALID_STATE',
        '仅对已发布或疑似已发布内容可执行该平台处置',
        { publishStatus: content.publishStatus, action: opts.verb },
      );
    }
    if (content.listingState === opts.target) {
      return this.toListingDto(content);
    }
    const from = content.listingState;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data: { listingState: opts.target },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: opts.auditAction,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromListingState: from,
          toListingState: opts.target,
          verb: opts.verb,
        },
      });
      return row;
    });
    return this.toListingDto(updated);
  }

  private async loadContentOrThrow404(contentId: string): Promise<Content> {
    assertUuidShapeOrNotFound(contentId, '内容不存在');
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) {
      throw new DomainHttpException(404, 'NOT_FOUND', '内容不存在', {});
    }
    return content;
  }

  private toListingDto(content: Content): PlatformContentListingDto {
    return {
      id: content.id,
      publishStatus: content.publishStatus,
      listingState: content.listingState,
    };
  }
}
