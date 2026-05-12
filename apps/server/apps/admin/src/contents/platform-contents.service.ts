import { Injectable } from '@nestjs/common';
import {
  ContentListingState,
  ContentPublishStatus,
  ModerationJobState,
  ModerationSubjectType,
  type Content,
  type Prisma,
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
import type { AdminContentListQuery } from './admin-content-list-query.dto';

/** 允许执行「下架 / 紧急隐藏」的内容发布态（PRD：针对已对外发布或疑似已发布内容）。 */
const LISTING_INTERVENTION_PUBLISH_STATUSES: ReadonlySet<ContentPublishStatus> =
  new Set([
    ContentPublishStatus.PUBLISHED,
    ContentPublishStatus.SUSPICIOUS_PUBLISHED,
  ]);

/** 管理端可发起审核的源状态；进入 `SUBMITTED` 后由机审 worker 推进终态。 */
const ADMIN_SUBMITTABLE_PUBLISH_STATUSES: ReadonlySet<ContentPublishStatus> =
  new Set([
    ContentPublishStatus.DRAFT,
    ContentPublishStatus.MACHINE_REJECTED,
    ContentPublishStatus.MANUALLY_REJECTED,
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
 * **输出 DTO**：管理端内容列表单行，覆盖占位内容、会员持有内容和机审队列内容。
 */
export type PlatformContentListItemDto = {
  /** 内容 id。 */
  id: string;
  /** 列表展示标题。 */
  title: string | null;
  /** 发布状态。 */
  publishStatus: ContentPublishStatus;
  /** 上架态。 */
  listingState: ContentListingState;
  /** 占位种类。 */
  placeholderKind: Content['placeholderKind'];
  /** Owner `MemberUser.id`；占位未兑换时为 `null`。 */
  ownerMemberId: string | null;
  /** 与内容 1:1 的权益 id；无权益时为 `null`。 */
  entitlementId: string | null;
  /** 该权益下兑换码总数；无权益时为 0。 */
  redemptionCodeCount: number;
  /**
   * 最近兑换码记录；含管理端展示的 `plainCode`（迁移前生成的码可为 `null`）。
   */
  redemptionCodes: PlatformContentRedemptionCodeDto[];
  /**
   * 权益嵌套视图（与 {@link PlatformContentEntitlementSnapshotDto}）；无权益时为 `null`。
   */
  entitlement: PlatformContentEntitlementSnapshotDto | null;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 更新时间 ISO8601。 */
  updatedAt: string;
};

/** **输出 DTO**：内容列表内展示的兑换码记录（含可选明文；永不返回 hash）。 */
export type PlatformContentRedemptionCodeDto = {
  /** 兑换码记录 id，可用于运营对账复制。 */
  id: string;
  /** C 端兑换输入明文；旧数据未持久化时为 `null`。 */
  plainCode: string | null;
  /** 兑换码状态。 */
  status: string;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 作废时间 ISO8601。 */
  invalidatedAt: string | null;
  /** 兑换成功时间 ISO8601。 */
  redeemedAt: string | null;
};

/**
 * **输出 DTO**：内容与权益 1:1 场景下，列表/详情共用的权益快照（嵌套于 `entitlement`；
 * 与扁平字段 `entitlementId`、`redemptionCodeCount`、`redemptionCodes` 同源）。
 */
export type PlatformContentEntitlementSnapshotDto = {
  /** `content_entitlements.id`。 */
  id: string;
  /** 绑定内容 id（`contents.id`）。 */
  contentId: string;
  /** 权益业务状态（`ACTIVE` / `ARCHIVED`）。 */
  status: string;
  /** 权益创建时间 ISO8601。 */
  createdAt: string;
  /** 权益更新时间 ISO8601。 */
  updatedAt: string;
  /** 创建权益的平台用户 id；历史数据可为 `null`。 */
  createdByUserId: string | null;
  /** 该权益下兑换码总数（列表接口内 `redemptionCodes` 可能仅为最近若干条）。 */
  redemptionCodeCount: number;
  /** 本响应携带的兑换码行（含明文；无 hash）。 */
  redemptionCodes: PlatformContentRedemptionCodeDto[];
};

/** **输出 DTO**：管理端内容分页列表。 */
export type PlatformContentListResultDto = {
  /** 当前页内容行。 */
  items: PlatformContentListItemDto[];
  /** 命中总行数。 */
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
  /** 该权益下兑换码总数；无权益时为 0。 */
  redemptionCodeCount: number;
  /** 关联权益下的兑换码明细（详情返回该权益下全量；按创建时间倒序）。 */
  redemptionCodes: PlatformContentRedemptionCodeDto[];
  /** 权益嵌套视图；无权益时为 `null`。 */
  entitlement: PlatformContentEntitlementSnapshotDto | null;
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
      select: {
        id: true,
        contentId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        _count: { select: { redemptionCodes: true } },
        redemptionCodes: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            plainCode: true,
            status: true,
            createdAt: true,
            invalidatedAt: true,
            redeemedAt: true,
          },
        },
      },
    });
    const bundle = this.buildEntitlementSnapshot(entitlement);
    return {
      id: content.id,
      title: content.title,
      body: content.body,
      publishStatus: content.publishStatus,
      listingState: content.listingState,
      placeholderKind: content.placeholderKind,
      ownerMemberId: content.ownerMemberId,
      entitlementId: bundle.entitlementId,
      redemptionCodeCount: bundle.redemptionCodeCount,
      redemptionCodes: bundle.redemptionCodes,
      entitlement: bundle.entitlement,
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

  /**
   * 将管理端列表筛选转为 Prisma `where`；条件之间为 **AND**。
   * 兑换码相关条件隐含「存在关联权益」。
   */
  private buildAdminContentListWhere(
    q: Omit<AdminContentListQuery, 'page' | 'pageSize'>,
  ): Prisma.ContentWhereInput {
    const parts: Prisma.ContentWhereInput[] = [];

    if (q.contentId) parts.push({ id: q.contentId });
    if (q.publishStatus) parts.push({ publishStatus: q.publishStatus });
    if (q.listingState) parts.push({ listingState: q.listingState });
    if (q.placeholderKind) parts.push({ placeholderKind: q.placeholderKind });
    if (q.ownerMemberId) parts.push({ ownerMemberId: q.ownerMemberId });
    if (q.entitlementId) parts.push({ entitlement: { id: q.entitlementId } });

    const title = q.titleContains?.trim();
    if (title) parts.push({ title: { contains: title } });

    if (q.createdFrom || q.createdTo) {
      parts.push({
        createdAt: {
          ...(q.createdFrom ? { gte: new Date(q.createdFrom) } : {}),
          ...(q.createdTo ? { lte: new Date(q.createdTo) } : {}),
        },
      });
    }
    if (q.updatedFrom || q.updatedTo) {
      parts.push({
        updatedAt: {
          ...(q.updatedFrom ? { gte: new Date(q.updatedFrom) } : {}),
          ...(q.updatedTo ? { lte: new Date(q.updatedTo) } : {}),
        },
      });
    }

    if (q.hasOwner === true) parts.push({ ownerMemberId: { not: null } });
    if (q.hasOwner === false) parts.push({ ownerMemberId: null });

    if (q.hasEntitlement === false) parts.push({ entitlement: null });
    if (q.hasEntitlement === true) {
      parts.push({ entitlement: { isNot: null } });
    }

    const rcPredicates: Prisma.RedemptionCodeWhereInput[] = [];
    const plain = q.redemptionPlainContains?.trim();
    if (plain) rcPredicates.push({ plainCode: { contains: plain } });
    if (q.redemptionCodeStatus) {
      rcPredicates.push({ status: q.redemptionCodeStatus });
    }
    if (q.redemptionCodeId) rcPredicates.push({ id: q.redemptionCodeId });

    if (rcPredicates.length > 0) {
      const some: Prisma.RedemptionCodeWhereInput =
        rcPredicates.length === 1 ? rcPredicates[0] : { AND: rcPredicates };
      parts.push({
        entitlement: {
          redemptionCodes: { some },
        },
      });
    }

    if (parts.length === 0) return {};
    return { AND: parts };
  }

  /** 分页列出全量内容，供管理端内容列表展示（可选多维筛选，条件 AND）。 */
  async listForAdmin(
    params: AdminContentListQuery,
  ): Promise<PlatformContentListResultDto> {
    const { page, pageSize, ...filters } = params;
    const { skip, take } = prismaSkipTake(page, pageSize);
    const where = this.buildAdminContentListWhere(filters);

    /**
     * 列表权益数据：**单独按 `content_id IN (...)` 查询 `content_entitlements`** 再合并，
     * 避免仅依赖 `Content → entitlement` 嵌套 `select` 时个别环境下关联未带出（表现为权益始终空）。
     */
    return this.prisma.$transaction(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.content.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take,
          select: {
            id: true,
            title: true,
            publishStatus: true,
            listingState: true,
            placeholderKind: true,
            ownerMemberId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        tx.content.count({ where }),
      ]);

      const contentIds = rows.map((r) => r.id);
      const entitlementRows =
        contentIds.length === 0
          ? []
          : await tx.contentEntitlement.findMany({
              where: { contentId: { in: contentIds } },
              select: {
                id: true,
                contentId: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                createdByUserId: true,
                _count: { select: { redemptionCodes: true } },
                redemptionCodes: {
                  orderBy: { createdAt: 'desc' },
                  take: 3,
                  select: {
                    id: true,
                    plainCode: true,
                    status: true,
                    createdAt: true,
                    invalidatedAt: true,
                    redeemedAt: true,
                  },
                },
              },
            });

      const entByContentId = new Map(
        entitlementRows.map((e) => [e.contentId, e]),
      );

      return {
        items: rows.map((r) => {
          const bundle = this.buildEntitlementSnapshot(
            entByContentId.get(r.id),
          );
          return {
            id: r.id,
            title: r.title,
            publishStatus: r.publishStatus,
            listingState: r.listingState,
            placeholderKind: r.placeholderKind,
            ownerMemberId: r.ownerMemberId,
            entitlementId: bundle.entitlementId,
            redemptionCodeCount: bundle.redemptionCodeCount,
            redemptionCodes: bundle.redemptionCodes,
            entitlement: bundle.entitlement,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        }),
        total,
        page,
        pageSize,
      };
    });
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

  /**
   * 管理端直接调整内容发布/上架权限字段，用于运营纠错；不改正文和 Owner。
   */
  async updatePermission(
    contentId: string,
    actorUserId: string,
    patch: {
      publishStatus?: ContentPublishStatus | undefined;
      listingState?: ContentListingState | undefined;
    },
  ): Promise<PlatformContentListingDto> {
    if (patch.publishStatus === undefined && patch.listingState === undefined) {
      throw new DomainHttpException(
        422,
        'VALIDATION_FAILED',
        '至少需要更新一个权限字段',
        {},
      );
    }
    const content = await this.loadContentOrThrow404(contentId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.content.update({
        where: { id: content.id },
        data: {
          ...(patch.publishStatus !== undefined
            ? { publishStatus: patch.publishStatus }
            : {}),
          ...(patch.listingState !== undefined
            ? { listingState: patch.listingState }
            : {}),
        },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.PLATFORM_CONTENT_PERMISSION_UPDATE,
        targetType: 'Content',
        targetId: content.id,
        payload: {
          fromPublishStatus: content.publishStatus,
          toPublishStatus: row.publishStatus,
          fromListingState: content.listingState,
          toListingState: row.listingState,
        },
      });
      return row;
    });
    return this.toListingDto(updated);
  }

  /**
   * 平台管理员代替 Owner 将内容送入机审队列；提交后统一由 worker 写终态。
   */
  async submitModeration(
    contentId: string,
    actorUserId: string,
  ): Promise<PlatformContentListingDto> {
    const content = await this.loadContentOrThrow404(contentId);
    if (!ADMIN_SUBMITTABLE_PUBLISH_STATUSES.has(content.publishStatus)) {
      throw new DomainHttpException(
        409,
        'CONTENT_ADMIN_SUBMIT_MODERATION_FORBIDDEN_STATE',
        '当前状态不可发起内容审核',
        { publishStatus: content.publishStatus },
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.content.update({
        where: { id: content.id },
        data: { publishStatus: ContentPublishStatus.SUBMITTED },
      });
      await tx.moderationJob.create({
        data: {
          subjectType: ModerationSubjectType.CONTENT,
          contentId: content.id,
          provider: 'noop',
          state: ModerationJobState.QUEUED,
        },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.PLATFORM_CONTENT_SUBMIT_MODERATION,
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

  /**
   * 将 Prisma 兑换码行转为列表/详情 DTO（枚举转为字符串便于 JSON 稳定）。
   */
  private mapRedemptionCodeRow(code: {
    id: string;
    plainCode: string | null;
    status: { toString(): string };
    createdAt: Date;
    invalidatedAt: Date | null;
    redeemedAt: Date | null;
  }): PlatformContentRedemptionCodeDto {
    return {
      id: code.id,
      plainCode: code.plainCode ?? null,
      status: String(code.status),
      createdAt: code.createdAt.toISOString(),
      invalidatedAt: code.invalidatedAt?.toISOString() ?? null,
      redeemedAt: code.redeemedAt?.toISOString() ?? null,
    };
  }

  /**
   * 从列表/详情查询中的 `entitlement` 选中块生成扁平字段 + 嵌套 `entitlement`；
   * `redemptionCodes` 数组形状与 Prisma `select` 一致（列表侧可能 `take` 截断）。
   */
  private buildEntitlementSnapshot(
    ent:
      | {
          id: string;
          contentId: string;
          status: { toString(): string };
          createdAt: Date;
          updatedAt: Date;
          createdByUserId: string | null;
          _count: { redemptionCodes: number };
          redemptionCodes: Array<{
            id: string;
            plainCode: string | null;
            status: { toString(): string };
            createdAt: Date;
            invalidatedAt: Date | null;
            redeemedAt: Date | null;
          }>;
        }
      | null
      | undefined,
  ): {
    entitlementId: string | null;
    redemptionCodeCount: number;
    redemptionCodes: PlatformContentRedemptionCodeDto[];
    entitlement: PlatformContentEntitlementSnapshotDto | null;
  } {
    if (!ent) {
      return {
        entitlementId: null,
        redemptionCodeCount: 0,
        redemptionCodes: [],
        entitlement: null,
      };
    }
    const redemptionCodes = ent.redemptionCodes.map((c) =>
      this.mapRedemptionCodeRow(c),
    );
    const redemptionCodeCount = ent._count.redemptionCodes;
    const snapshot: PlatformContentEntitlementSnapshotDto = {
      id: ent.id,
      contentId: ent.contentId,
      status: String(ent.status),
      createdAt: ent.createdAt.toISOString(),
      updatedAt: ent.updatedAt.toISOString(),
      createdByUserId: ent.createdByUserId,
      redemptionCodeCount,
      redemptionCodes,
    };
    return {
      entitlementId: ent.id,
      redemptionCodeCount,
      redemptionCodes,
      entitlement: snapshot,
    };
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
