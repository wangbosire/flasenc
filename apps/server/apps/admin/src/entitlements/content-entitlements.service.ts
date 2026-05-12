import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ContentPlaceholderKind, Prisma } from '@prisma/client';
import { AuditAction, AuditLogService, PrismaService } from '@app/database';
import { DomainHttpException, zUuidChar36 } from '@app/http';
import { hashRedemptionCode } from '@app/shared';

const entitlementIdParamSchema = zUuidChar36('权益 id 格式无效');

/** **输入 DTO**：创建权益时可选占位标题（省略则由实现使用 `null` 等默认）。 */
export type CreateEntitlementDto = {
  /** 绑定占位内容的展示标题；不传则由服务写默认/空。 */
  title?: string | undefined;
};

/**
 * **输入 DTO**：生成兑换码；`plainCode` 省略则服务端随机生成，**仅 HTTP 响应返回一次明文**。
 */
export type CreateRedemptionCodeDto = {
  /** 省略则服务端生成随机明文（仅创建响应返回一次）。 */
  plainCode?: string | undefined;
};

/**
 * **输入 DTO**：创建占位内容、权益并立即生成兑换码；明文码仍仅响应一次。
 */
export type CreateRedemptionCodeWithContentDto = {
  /** 占位内容标题；不传则内容标题为空。 */
  title?: string | undefined;
  /** 省略则服务端生成随机明文（仅创建响应返回一次）。 */
  plainCode?: string | undefined;
};

/** **输出 DTO**：一体化生成兑换码结果。 */
export type CreatedRedemptionCodeWithContentDto = {
  /** 新建权益 id。 */
  entitlementId: string;
  /** 新建占位内容 id。 */
  contentId: string;
  /** 新建兑换码记录 id。 */
  redemptionCodeId: string;
  /** 兑换码明文（同事务写入 `redemption_codes.plain_code`）；不进审计 payload。 */
  plainCode: string;
};

@Injectable()
export class ContentEntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * PRD：创建内容权益时 **原子** 创建绑定占位 `Content`（1:1）。
   * 路由层由 {@link AdminJwtAuthGuard} 限制为 **`platformAdmin`** 用户。
   */
  async createEntitlementWithPlaceholder(
    dto: CreateEntitlementDto,
    actorUserId: string,
  ): Promise<{
    entitlementId: string;
    contentId: string;
    redemptionCodeId: string;
    plainCode: string;
  }> {
    /**
     * 内容与权益 1:1；产品与兑换链路约定每条权益 **恰有一条** 兑换码，同事务写入，
     * 避免出现「仅有 entitlement、列表兑换码列为空」的半完成数据。
     */
    return this.prisma.$transaction(async (tx) => {
      const content = await tx.content.create({
        data: {
          placeholderKind: ContentPlaceholderKind.PLACEHOLDER,
          title: dto.title ?? null,
        },
      });
      const entitlement = await tx.contentEntitlement.create({
        data: {
          contentId: content.id,
          createdByUserId: actorUserId,
        },
      });

      const { plainCode, redemptionCodeId } =
        await this.createRedemptionCodeRowWithRetry(tx, entitlement.id, {});

      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.CONTENT_ENTITLEMENT_CREATE,
        targetType: 'ContentEntitlement',
        targetId: entitlement.id,
        payload: { contentId: content.id, redemptionCodeId },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.REDEMPTION_CODE_CREATE,
        targetType: 'RedemptionCode',
        targetId: redemptionCodeId,
        payload: {
          entitlementId: entitlement.id,
          contentId: content.id,
        },
      });

      return {
        entitlementId: entitlement.id,
        contentId: content.id,
        redemptionCodeId,
        plainCode,
      };
    });
  }

  /**
   * 在指定权益下生成一条兑换码记录：**明文 `plain_code` 与摘要 `code_hash` 同事务写入**；兑换优先明文匹配（审计仍不含明文）。
   */
  async createRedemptionCode(
    entitlementIdRaw: string,
    dto: CreateRedemptionCodeDto,
    actorUserId: string,
  ): Promise<{ plainCode: string; redemptionCodeId: string }> {
    const param = entitlementIdParamSchema.safeParse(entitlementIdRaw);
    if (!param.success) {
      throw new DomainHttpException(
        422,
        'VALIDATION_FAILED',
        '权益 id 格式无效',
        { field: 'entitlementId' },
      );
    }
    const entitlementId = param.data;

    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.contentEntitlement.findUnique({
        where: { id: entitlementId },
      });
      if (!entitlement) {
        throw new DomainHttpException(
          404,
          'CONTENT_ENTITLEMENT_NOT_FOUND',
          '内容权益不存在',
          {},
        );
      }

      const existingCode = await tx.redemptionCode.findFirst({
        where: { entitlementId },
        select: { id: true },
      });
      if (existingCode) {
        throw new DomainHttpException(
          409,
          'CONTENT_REDEMPTION_CODE_ALREADY_ISSUED',
          '该权益已绑定兑换码；内容与权益、兑换码为 1:1:1，不可重复生成',
          {},
        );
      }

      const maxAttempts = dto.plainCode ? 1 : 8;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const plainCode =
          dto.plainCode?.trim() ??
          randomBytes(12).toString('base64url').slice(0, 20);
        if (!plainCode || plainCode.length < 4) {
          throw new DomainHttpException(
            422,
            'VALIDATION_FAILED',
            '兑换码明文过短',
            {},
          );
        }
        const codeHash = hashRedemptionCode(plainCode);
        try {
          const row = await tx.redemptionCode.create({
            data: {
              entitlementId,
              codeHash,
              plainCode,
            },
          });
          await this.auditLog.append(tx, {
            actorUserId,
            action: AuditAction.REDEMPTION_CODE_CREATE,
            targetType: 'RedemptionCode',
            targetId: row.id,
            payload: {
              entitlementId,
              /** 明文写库仅便于管理端列表展示；不进审计 payload */
            },
          });
          return { plainCode, redemptionCodeId: row.id };
        } catch (e: unknown) {
          const isUnique =
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002';
          if (dto.plainCode && isUnique) {
            throw new DomainHttpException(
              409,
              'CONTENT_REDEMPTION_CODE_PLAIN_CONFLICT',
              '该明文码已存在（哈希冲突），请更换后重试',
              {},
            );
          }
          if (!dto.plainCode && isUnique) {
            continue;
          }
          throw e;
        }
      }
      throw new DomainHttpException(
        500,
        'INTERNAL_ERROR',
        '生成兑换码失败，请稍后重试',
        {},
      );
    });
  }

  /**
   * 运营生成兑换码的主路径：同一事务内创建占位内容、权益和兑换码。
   * 这样前端不需要先拿 `entitlementId` 再二次调用，避免半完成状态。
   */
  async createRedemptionCodeWithContent(
    dto: CreateRedemptionCodeWithContentDto,
    actorUserId: string,
  ): Promise<CreatedRedemptionCodeWithContentDto> {
    return this.prisma.$transaction(async (tx) => {
      const content = await tx.content.create({
        data: {
          placeholderKind: ContentPlaceholderKind.PLACEHOLDER,
          title: dto.title ?? null,
        },
      });
      const entitlement = await tx.contentEntitlement.create({
        data: {
          contentId: content.id,
          createdByUserId: actorUserId,
        },
      });

      const { plainCode, redemptionCodeId } =
        await this.createRedemptionCodeRowWithRetry(tx, entitlement.id, dto);

      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.CONTENT_ENTITLEMENT_CREATE,
        targetType: 'ContentEntitlement',
        targetId: entitlement.id,
        payload: { contentId: content.id, redemptionCodeId },
      });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.REDEMPTION_CODE_CREATE,
        targetType: 'RedemptionCode',
        targetId: redemptionCodeId,
        payload: {
          entitlementId: entitlement.id,
          contentId: content.id,
          /** 明文写库仅便于管理端列表展示；不进审计 payload */
        },
      });

      return {
        entitlementId: entitlement.id,
        contentId: content.id,
        redemptionCodeId,
        plainCode,
      };
    });
  }

  private async createRedemptionCodeRowWithRetry(
    tx: Prisma.TransactionClient,
    entitlementId: string,
    dto: CreateRedemptionCodeDto,
  ): Promise<{ plainCode: string; redemptionCodeId: string }> {
    const maxAttempts = dto.plainCode ? 1 : 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const plainCode =
        dto.plainCode?.trim() ??
        randomBytes(12).toString('base64url').slice(0, 20);
      if (!plainCode || plainCode.length < 4) {
        throw new DomainHttpException(
          422,
          'VALIDATION_FAILED',
          '兑换码明文过短',
          {},
        );
      }
      const codeHash = hashRedemptionCode(plainCode);
      try {
        const row = await tx.redemptionCode.create({
          data: {
            entitlementId,
            codeHash,
            plainCode,
          },
        });
        return { plainCode, redemptionCodeId: row.id };
      } catch (e: unknown) {
        const isUnique =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (dto.plainCode && isUnique) {
          throw new DomainHttpException(
            409,
            'CONTENT_REDEMPTION_CODE_PLAIN_CONFLICT',
            '该明文码已存在（哈希冲突），请更换后重试',
            {},
          );
        }
        if (!dto.plainCode && isUnique) {
          continue;
        }
        throw e;
      }
    }
    throw new DomainHttpException(
      500,
      'INTERNAL_ERROR',
      '生成兑换码失败，请稍后重试',
      {},
    );
  }
}
