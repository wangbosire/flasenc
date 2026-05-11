import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TransferStatus } from '@prisma/client';
import {
  appendAuditLogDetached,
  AuditAction,
  PrismaService,
} from '@app/database';

/** 单次 tick 最多处理条数，避免长事务。 */
const BATCH_SIZE = 50;

/** 转让过期扫描间隔；与「按自然日截止」粒度匹配，无需与机审同频。 */
const TICK_MS = 60_000;

/**
 * 将 **`PENDING`** 且 **`expiresAt` < 当前时间** 的 **`content_transfers`** 置为 **`EXPIRED`**，
 * 与确认接口的时间窗校验形成双保险（多实例下依赖条件 `updateMany` 避免重复落库）。
 */
@Injectable()
export class TransferExpiryProcessorService {
  private readonly logger = new Logger(TransferExpiryProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 与 {@link Interval} 共用；测试可显式调用，无需等待调度。 */
  async expirePendingBatch(): Promise<void> {
    const now = new Date();
    const candidates = await this.prisma.contentTransfer.findMany({
      where: {
        status: TransferStatus.PENDING,
        expiresAt: { lt: now },
      },
      select: { id: true, contentId: true },
      orderBy: { expiresAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const row of candidates) {
      const updated = await this.prisma.contentTransfer.updateMany({
        where: {
          id: row.id,
          status: TransferStatus.PENDING,
          expiresAt: { lt: now },
        },
        data: { status: TransferStatus.EXPIRED },
      });
      if (updated.count !== 1) {
        continue;
      }
      try {
        await appendAuditLogDetached(this.prisma, {
          action: AuditAction.CONTENT_TRANSFER_EXPIRE_JOB,
          targetType: 'ContentTransfer',
          targetId: row.id,
          actorMemberId: null,
          actorUserId: null,
          payload: { contentId: row.contentId },
        });
      } catch (err: unknown) {
        this.logger.warn(
          `audit after transfer expire failed id=${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  @Interval(TICK_MS)
  handleTransferExpiryTick(): void {
    void this.expirePendingBatch().catch((err: unknown) => {
      this.logger.warn(
        `expirePendingBatch failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }
}
