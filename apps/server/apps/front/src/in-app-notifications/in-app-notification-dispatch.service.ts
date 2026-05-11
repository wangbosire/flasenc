import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * 在 **业务事务内** 写入站内信；与 {@link InAppNotificationsService} 列表 API 解耦。
 * 若会员将 **`channelInApp`** 置为 **`false`**，则不创建行（与偏好语义一致）。
 */
@Injectable()
export class InAppNotificationDispatchService {
  /**
   * 使用调用方传入的 **`tx`**，避免「通知已写、业务回滚」的不一致。
   */
  async enqueueForMemberTx(
    tx: Prisma.TransactionClient,
    params: {
      memberId: string;
      category: string;
      title: string;
      body: string;
      data?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const pref = await tx.memberNotificationPreference.findUnique({
      where: { memberId: params.memberId },
      select: { channelInApp: true },
    });
    if (pref?.channelInApp === false) {
      return;
    }
    await tx.inAppNotification.create({
      data: {
        memberId: params.memberId,
        category: params.category,
        title: params.title,
        body: params.body,
        data: params.data ?? undefined,
      },
    });
  }
}
