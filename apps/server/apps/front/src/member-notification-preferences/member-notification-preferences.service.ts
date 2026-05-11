import { Injectable } from '@nestjs/common';
import {
  assertMemberUserEmailPresent,
  AuditAction,
  AuditLogService,
  PrismaService,
} from '@app/database';

/**
 * **输出 DTO**：会员通知渠道偏好（GET/PATCH 响应）；无库行时 GET 仍返回默认布尔与 `updatedAt: null`。
 */
export type MemberNotificationPreferencesDto = {
  /** 当前会员 `MemberUser.id`。 */
  memberId: string;
  /** 是否接收应用内通知渠道。 */
  channelInApp: boolean;
  /** 是否接收小程序渠道（预留/能力开关）。 */
  channelMiniProgram: boolean;
  /** 尚无持久化行时为 `null`（与 Prisma 默认一致，仅 GET 合并展示）。 */
  updatedAt: string | null;
};

@Injectable()
export class MemberNotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(memberId: string): Promise<MemberNotificationPreferencesDto> {
    await assertMemberUserEmailPresent(this.prisma, memberId);
    const row = await this.prisma.memberNotificationPreference.findUnique({
      where: { memberId },
    });
    return {
      memberId,
      channelInApp: row?.channelInApp ?? true,
      channelMiniProgram: row?.channelMiniProgram ?? false,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  }

  async patch(
    memberId: string,
    patch: { channelInApp?: boolean; channelMiniProgram?: boolean },
  ): Promise<MemberNotificationPreferencesDto> {
    await assertMemberUserEmailPresent(this.prisma, memberId);
    const existing = await this.prisma.memberNotificationPreference.findUnique({
      where: { memberId },
    });
    const next = {
      channelInApp: patch.channelInApp ?? existing?.channelInApp ?? true,
      channelMiniProgram:
        patch.channelMiniProgram ?? existing?.channelMiniProgram ?? false,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.memberNotificationPreference.upsert({
        where: { memberId },
        create: {
          memberId,
          channelInApp: next.channelInApp,
          channelMiniProgram: next.channelMiniProgram,
        },
        update: {
          channelInApp: next.channelInApp,
          channelMiniProgram: next.channelMiniProgram,
        },
      });
      await this.auditLog.append(tx, {
        actorMemberId: memberId,
        action: AuditAction.MEMBER_NOTIFICATION_PREFERENCE_UPDATE,
        targetType: 'MemberNotificationPreference',
        targetId: memberId,
        payload: {
          channelInApp: next.channelInApp,
          channelMiniProgram: next.channelMiniProgram,
        },
      });
    });

    const row =
      await this.prisma.memberNotificationPreference.findUniqueOrThrow({
        where: { memberId },
      });
    return {
      memberId,
      channelInApp: row.channelInApp,
      channelMiniProgram: row.channelMiniProgram,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
