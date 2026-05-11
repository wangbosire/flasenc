import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ContentTransfer } from '@prisma/client';
import {
  ContentListingState,
  ContentPublishStatus,
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
  type OffsetPageQuery,
} from '@app/http';
import { hashRedemptionCode, transferExpiresAtShanghai } from '@app/shared';

const TRANSFERABLE: ReadonlySet<ContentPublishStatus> = new Set([
  ContentPublishStatus.PUBLISHED,
  ContentPublishStatus.SUSPICIOUS_PUBLISHED,
]);

function hashTransferCode(plain: string): string {
  return hashRedemptionCode(`transfer:${plain}`);
}

function hashCardToken(plain: string): string {
  return hashRedemptionCode(`card:${plain}`);
}

function randomUrlToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url').replace(/=/g, '');
}

/**
 * **输出 DTO**：某内容下转让单列表单行；**不含**明文码或卡片 token（仅元数据 + 时间戳）。
 */
export type ContentTransferListItemDto = {
  /** `content_transfers.id`。 */
  id: string;
  /** 转让方式（口令 / 卡片分享等）。 */
  method: TransferMethod;
  /** 转让单生命周期状态。 */
  status: TransferStatus;
  /** 凭证过期时间 ISO8601（上海时区业务日边界由实现约定）。 */
  expiresAt: string;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 受让方确认完成时间；未完成则为 `null`。 */
  confirmedAt: string | null;
  /** Owner 撤销时间；未撤销为 `null`。 */
  revokedAt: string | null;
};

/** **输出 DTO**：Owner 查看转让历史分页结果。 */
export type ContentTransferListResultDto = {
  /** 当前页转让单摘要列表。 */
  items: ContentTransferListItemDto[];
  /** 该内容下转让单总数。 */
  total: number;
  /** 当前页码（从 1 起）。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

/**
 * **输出 DTO**：发起转让成功响应；敏感凭证仅 **`TRANSFER_CODE`** / **`CARD_SHARE`** 对应字段返回且各最多一次。
 */
export type CreateTransferResultDto = {
  /** 新创建的转让单 id。 */
  transferId: string;
  /** 与请求一致的方式枚举。 */
  method: TransferMethod;
  /** 本单凭证过期时间 ISO8601。 */
  expiresAt: string;
  /** 仅 **`TRANSFER_CODE`** 返回一次；客户端须自行保管。 */
  transferCode?: string;
  /** 仅 **`CARD_SHARE`** 返回一次。 */
  cardToken?: string;
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private toListItem(row: ContentTransfer): ContentTransferListItemDto {
    return {
      id: row.id,
      ...contentTransferCoreTimestampsToDto(row),
    };
  }

  async listForContentOwner(
    memberId: string,
    contentId: string,
    query: OffsetPageQuery,
  ): Promise<ContentTransferListResultDto> {
    assertUuidShapeOrNotFound(contentId, '内容不存在');
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content || content.ownerMemberId !== memberId) {
      throw new DomainHttpException(
        403,
        'CONTENT_OWNER_ACTION_FORBIDDEN',
        '仅内容 Owner 可查看转让记录',
        {},
      );
    }
    const { page, pageSize } = query;
    const { total, rows } = await findContentTransfersPageByContentId(
      this.prisma,
      contentId,
      page,
      pageSize,
    );
    return {
      items: rows.map((r) => this.toListItem(r)),
      total,
      page,
      pageSize,
    };
  }

  async initiateTransfer(params: {
    memberId: string;
    contentId: string;
    method: TransferMethod;
  }): Promise<CreateTransferResultDto> {
    const { memberId, contentId, method } = params;
    assertUuidShapeOrNotFound(contentId, '内容不存在');
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content || content.ownerMemberId !== memberId) {
      throw new DomainHttpException(
        403,
        'CONTENT_OWNER_ACTION_FORBIDDEN',
        '仅内容 Owner 可发起转让',
        {},
      );
    }
    if (
      !TRANSFERABLE.has(content.publishStatus) ||
      content.listingState !== ContentListingState.NORMAL
    ) {
      throw new DomainHttpException(
        409,
        'CONTENT_TRANSFER_FORBIDDEN_STATE',
        '当前内容状态不允许发起转让',
        { publishStatus: content.publishStatus },
      );
    }

    const now = new Date();
    const expiresAt = transferExpiresAtShanghai(now);

    const pending = await this.prisma.contentTransfer.findFirst({
      where: { contentId, status: TransferStatus.PENDING },
    });
    if (pending) {
      throw new DomainHttpException(
        409,
        'CONTENT_TRANSFER_PENDING_CONFLICT',
        '该内容已存在待确认的转让',
        { transferId: pending.id },
      );
    }

    let codeHash: string | null = null;
    let cardTokenHash: string | null = null;
    let transferCodePlain: string | undefined;
    let cardTokenPlain: string | undefined;

    if (method === TransferMethod.TRANSFER_CODE) {
      transferCodePlain = `tr-${randomUrlToken(18)}`;
      codeHash = hashTransferCode(transferCodePlain);
    } else {
      cardTokenPlain = `ct-${randomUrlToken(24)}`;
      cardTokenHash = hashCardToken(cardTokenPlain);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const t = await tx.contentTransfer.create({
        data: {
          contentId,
          fromMemberId: memberId,
          method,
          codeHash,
          cardTokenHash,
          status: TransferStatus.PENDING,
          expiresAt,
        },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_TRANSFER_CREATE,
        targetType: 'ContentTransfer',
        targetId: t.id,
        payload: { contentId, method },
      });
      return t;
    });

    return {
      transferId: row.id,
      method: row.method,
      expiresAt: row.expiresAt.toISOString(),
      ...(method === TransferMethod.TRANSFER_CODE
        ? { transferCode: transferCodePlain! }
        : { cardToken: cardTokenPlain! }),
    };
  }

  async revokeTransfer(params: {
    memberId: string;
    transferId: string;
  }): Promise<{ ok: true }> {
    const { memberId, transferId } = params;
    assertUuidShapeOrNotFound(transferId, '转让单不存在');
    const row = await this.prisma.contentTransfer.findUnique({
      where: { id: transferId },
    });
    if (!row) {
      throw new DomainHttpException(404, 'NOT_FOUND', '转让单不存在', {});
    }
    if (row.fromMemberId !== memberId) {
      throw new DomainHttpException(
        403,
        'CONTENT_OWNER_ACTION_FORBIDDEN',
        '仅发起方可撤销',
        {},
      );
    }
    if (row.status !== TransferStatus.PENDING) {
      throw new DomainHttpException(
        409,
        'CONTENT_TRANSFER_INVALID_STATE',
        '当前转让单不可撤销',
        { status: row.status },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_TRANSFER_REVOKE,
        targetType: 'ContentTransfer',
        targetId: transferId,
        payload: { contentId: row.contentId },
      });
    });
    return { ok: true as const };
  }

  async confirmTransfer(params: {
    memberId: string;
    transferId: string;
    transferCode?: string;
    cardToken?: string;
  }): Promise<{ ok: true; contentId: string }> {
    const { memberId, transferId } = params;
    assertUuidShapeOrNotFound(transferId, '转让单不存在');
    const row = await this.prisma.contentTransfer.findUnique({
      where: { id: transferId },
      include: { content: true },
    });
    if (!row) {
      throw new DomainHttpException(404, 'NOT_FOUND', '转让单不存在', {});
    }
    const now = new Date();
    // 与 {@link TransferExpiryProcessorService} 对齐：已落 **`EXPIRED`** 时仍用「过期」码，避免客户端误当成可重试的冲突态。
    if (row.status === TransferStatus.EXPIRED) {
      throw new DomainHttpException(
        400,
        'CONTENT_TRANSFER_EXPIRED',
        '转让已过期',
        { expiresAt: row.expiresAt.toISOString(), status: row.status },
      );
    }
    if (row.status !== TransferStatus.PENDING) {
      throw new DomainHttpException(
        409,
        'CONTENT_TRANSFER_INVALID_STATE',
        '当前转让单不可确认',
        { status: row.status },
      );
    }
    if (now.getTime() > row.expiresAt.getTime()) {
      throw new DomainHttpException(
        400,
        'CONTENT_TRANSFER_EXPIRED',
        '转让已过期',
        { expiresAt: row.expiresAt.toISOString() },
      );
    }

    if (row.fromMemberId === memberId) {
      throw new DomainHttpException(
        400,
        'CONTENT_TRANSFER_SELF_NOT_ALLOWED',
        '不能确认本人发起的转让',
        {},
      );
    }

    if (row.method === TransferMethod.TRANSFER_CODE) {
      const plain = params.transferCode?.trim();
      if (!plain || !row.codeHash) {
        throw new DomainHttpException(
          422,
          'VALIDATION_FAILED',
          '须提供 transferCode',
          { fields: { transferCode: ['必填'] } },
        );
      }
      if (row.codeHash !== hashTransferCode(plain)) {
        throw new DomainHttpException(
          400,
          'CONTENT_TRANSFER_SECRET_MISMATCH',
          '转让码不正确',
          {},
        );
      }
    } else {
      const token = params.cardToken?.trim();
      if (!token || !row.cardTokenHash) {
        throw new DomainHttpException(
          422,
          'VALIDATION_FAILED',
          '须提供 cardToken',
          { fields: { cardToken: ['必填'] } },
        );
      }
      if (row.cardTokenHash !== hashCardToken(token)) {
        throw new DomainHttpException(
          400,
          'CONTENT_TRANSFER_SECRET_MISMATCH',
          '卡片凭证不正确',
          {},
        );
      }
    }

    const contentId = row.contentId;
    await this.prisma.$transaction(async (tx) => {
      await tx.contentTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CONFIRMED,
          confirmedAt: now,
          toMemberId: memberId,
        },
      });
      await tx.content.update({
        where: { id: contentId },
        data: { ownerMemberId: memberId },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.CONTENT_TRANSFER_CONFIRM,
        targetType: 'ContentTransfer',
        targetId: transferId,
        payload: { contentId, fromMemberId: row.fromMemberId },
      });
    });

    return { ok: true as const, contentId };
  }
}
