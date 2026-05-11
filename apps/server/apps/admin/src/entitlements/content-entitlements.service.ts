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
  ): Promise<{ entitlementId: string; contentId: string }> {
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
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.CONTENT_ENTITLEMENT_CREATE,
        targetType: 'ContentEntitlement',
        targetId: entitlement.id,
        payload: { contentId: content.id },
      });
      return {
        entitlementId: entitlement.id,
        contentId: content.id,
      };
    });
  }

  /**
   * 在指定权益下生成一条兑换码记录（仅存 hash）；`plainCode` 仅在本响应返回一次。
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
            },
          });
          await this.auditLog.append(tx, {
            actorUserId,
            action: AuditAction.REDEMPTION_CODE_CREATE,
            targetType: 'RedemptionCode',
            targetId: row.id,
            payload: {
              entitlementId,
              /** 明文不落库、不进审计，仅记权益与码 id */
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
}
