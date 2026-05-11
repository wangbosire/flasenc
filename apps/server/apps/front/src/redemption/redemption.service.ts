import { Injectable } from '@nestjs/common';
import { ContentPlaceholderKind, RedemptionCodeStatus } from '@prisma/client';
import {
  assertMemberUserRowExists,
  AuditAction,
  AuditLogService,
  PrismaService,
} from '@app/database';
import { DomainHttpException } from '@app/http';
import { hashRedemptionCode } from '@app/shared';
import { InAppNotificationCategory } from '../in-app-notifications/in-app-notification-categories';
import { InAppNotificationDispatchService } from '../in-app-notifications/in-app-notification-dispatch.service';

/**
 * **输出 DTO**：兑换成功后的最小回包（跳转/展示内容用 `contentId`，审计或二次请求用 `ownerMemberId`）。
 */
export type RedeemResult = {
  /** 兑换成功后绑定的内容 id（跳转详情用）。 */
  contentId: string;
  /** 内容 Owner：`MemberUser.id`。 */
  ownerMemberId: string;
};

@Injectable()
export class RedemptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly inAppNotificationDispatch: InAppNotificationDispatchService,
  ) {}

  /**
   * 已登录会员凭明文码兑换：一码一用、并发下至多一方成功（`updateMany` 行数校验）。
   * `memberId` 由 {@link JwtAuthGuard} 从 JWT `sub` 解析（对应 `MemberUser.id`）。
   */
  async redeem(params: {
    memberId: string;
    plainCode: string;
  }): Promise<RedeemResult> {
    const { memberId } = params;
    const codeHash = hashRedemptionCode(params.plainCode);

    await assertMemberUserRowExists(this.prisma, memberId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.redemptionCode.findUnique({
          where: { codeHash },
          include: { entitlement: { include: { content: true } } },
        });

        if (!row) {
          throw new DomainHttpException(
            404,
            'CONTENT_REDEMPTION_CODE_NOT_FOUND',
            '兑换码不存在或不可用',
            {},
          );
        }

        if (row.status === RedemptionCodeStatus.INVALIDATED) {
          throw new DomainHttpException(
            400,
            'CONTENT_REDEMPTION_CODE_INVALIDATED',
            '该兑换码已失效',
            {
              invalidatedAt: row.invalidatedAt?.toISOString() ?? null,
              redemptionCodeId: row.id,
            },
          );
        }

        if (row.status === RedemptionCodeStatus.REDEEMED) {
          throw new DomainHttpException(
            409,
            'CONTENT_REDEMPTION_CODE_ALREADY_USED',
            '该兑换码已被使用',
            { redemptionCodeId: row.id },
          );
        }

        const mark = await tx.redemptionCode.updateMany({
          where: {
            id: row.id,
            status: RedemptionCodeStatus.ACTIVE,
          },
          data: {
            status: RedemptionCodeStatus.REDEEMED,
            redeemedAt: new Date(),
            redeemedByMemberId: memberId,
          },
        });

        if (mark.count !== 1) {
          throw new DomainHttpException(
            409,
            'CONTENT_REDEMPTION_CODE_ALREADY_USED',
            '该兑换码已被使用',
            { redemptionCodeId: row.id },
          );
        }

        const contentId = row.entitlement.contentId;

        await tx.content.update({
          where: { id: contentId },
          data: {
            ownerMemberId: memberId,
            placeholderKind: ContentPlaceholderKind.OWNED,
          },
        });

        await this.auditLog.append(tx, {
          actorMemberId: memberId,
          action: AuditAction.CONTENT_REDEEM_SUCCESS,
          targetType: 'Content',
          targetId: contentId,
          payload: {
            redemptionCodeId: row.id,
            entitlementId: row.entitlementId,
          },
        });

        await this.inAppNotificationDispatch.enqueueForMemberTx(tx, {
          memberId,
          category: InAppNotificationCategory.CONTENT_REDEEM_SUCCESS,
          title: '兑换成功',
          body: '您已成功领取内容，可在「我的内容」中继续编辑或发布。',
          data: {
            contentId,
            entitlementId: row.entitlementId,
            redemptionCodeId: row.id,
          },
        });

        return { contentId, ownerMemberId: memberId };
      });
    } catch (err) {
      await this.recordRedeemFailureIfApplicable(memberId, codeHash, err);
      throw err;
    }
  }

  /**
   * 兑换失败审计须在 **事务外** 写入，否则与 `throw` 同事务会随回滚丢失（PRD §13）。
   */
  private async recordRedeemFailureIfApplicable(
    memberId: string,
    codeHash: string,
    err: unknown,
  ): Promise<void> {
    if (!(err instanceof DomainHttpException)) {
      return;
    }
    const audited = new Set([
      'CONTENT_REDEMPTION_CODE_NOT_FOUND',
      'CONTENT_REDEMPTION_CODE_INVALIDATED',
      'CONTENT_REDEMPTION_CODE_ALREADY_USED',
    ]);
    if (!audited.has(err.errorCode)) {
      return;
    }
    const rid = err.details['redemptionCodeId'];
    const redemptionCodeId =
      typeof rid === 'string' && rid.length > 0 ? rid : undefined;
    const targetType =
      redemptionCodeId !== undefined ? 'RedemptionCode' : 'MemberUser';
    const targetId = redemptionCodeId ?? memberId;
    await this.auditLog.append(this.prisma, {
      actorMemberId: memberId,
      action: AuditAction.CONTENT_REDEEM_FAILURE,
      targetType,
      targetId,
      payload: {
        errorCode: err.errorCode,
        ...(redemptionCodeId !== undefined
          ? { redemptionCodeId }
          : { codeHashPrefix: codeHash.slice(0, 16) }),
      },
    });
  }
}
