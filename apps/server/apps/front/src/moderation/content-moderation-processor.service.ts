import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  ContentListingState,
  ContentPublishStatus,
  ModerationJobState,
  ModerationSubjectType,
  type Prisma,
} from '@prisma/client';
import {
  appendAuditLogDetached,
  AuditAction,
  PrismaService,
} from '@app/database';
import { InAppNotificationCategory } from '../in-app-notifications/in-app-notification-categories';
import { InAppNotificationDispatchService } from '../in-app-notifications/in-app-notification-dispatch.service';
import { ContentModerationOutcomeProvider } from './content-moderation-outcome.provider';

/** 每 tick 最多拉取的 QUEUED 任务数，避免单次持锁过久。 */
const BATCH_SIZE = 20;

/**
 * 消费 `CONTENT` 机审队列：先 **claim**（`QUEUED`→`PROCESSING`），再按供应商策略落终态。
 * 机审结论由注入的 {@link ContentModerationOutcomeProvider} 决定（MVP 为 noop + 环境变量）。
 * 多实例时依赖 `updateMany` 条件更新做互斥；单条失败不阻塞同批其它任务。
 */
@Injectable()
export class ContentModerationProcessorService {
  private readonly logger = new Logger(ContentModerationProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationOutcome: ContentModerationOutcomeProvider,
    private readonly inAppNotificationDispatch: InAppNotificationDispatchService,
  ) {}

  /** 测试与运维可显式触发；与 {@link Interval} 共用同一处理逻辑。 */
  async processQueuedBatch(): Promise<void> {
    const queued = await this.prisma.moderationJob.findMany({
      where: {
        subjectType: ModerationSubjectType.CONTENT,
        state: ModerationJobState.QUEUED,
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });

    for (const row of queued) {
      await this.tryProcessOne(row.id);
    }
  }

  @Interval(5_000)
  handleModerationQueueTick(): void {
    void this.processQueuedBatch().catch((err: unknown) => {
      this.logger.warn(
        `processQueuedBatch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async tryProcessOne(jobId: string): Promise<void> {
    const claimed = await this.prisma.moderationJob.updateMany({
      where: { id: jobId, state: ModerationJobState.QUEUED },
      data: { state: ModerationJobState.PROCESSING },
    });
    if (claimed.count === 0) {
      return;
    }

    const job = await this.prisma.moderationJob.findUnique({
      where: { id: jobId },
      select: { contentId: true, provider: true },
    });
    const contentId = job?.contentId;
    if (!contentId) {
      await this.failJob(jobId, 'missing_content_id');
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const content = await tx.content.findUnique({
          where: { id: contentId },
          select: { publishStatus: true, ownerMemberId: true },
        });
        if (!content) {
          await tx.moderationJob.update({
            where: { id: jobId },
            data: {
              state: ModerationJobState.FAILED,
              resultPayload: {
                outcome: 'SKIPPED',
                reason: 'content_not_found',
              },
            },
          });
          return;
        }

        // 仅当仍处于「已提交待审」时消费，避免与平台干预或重复消费竞态。
        if (content.publishStatus !== ContentPublishStatus.SUBMITTED) {
          await tx.moderationJob.update({
            where: { id: jobId },
            data: {
              state: ModerationJobState.FAILED,
              resultPayload: {
                outcome: 'SKIPPED',
                reason: 'unexpected_publish_status',
                publishStatus: content.publishStatus,
              },
            },
          });
          return;
        }

        const provider = job?.provider ?? 'noop';
        const verdict = this.moderationOutcome.decideContentOutcome({
          provider,
          contentId,
        });

        if (verdict === 'reject') {
          await tx.moderationJob.update({
            where: { id: jobId },
            data: {
              state: ModerationJobState.COMPLETED,
              resultPayload: {
                outcome: 'REJECTED',
                provider,
                async: true,
              },
            },
          });
          await tx.content.update({
            where: { id: contentId },
            data: { publishStatus: ContentPublishStatus.MACHINE_REJECTED },
          });
          await this.appendModerationOutcomeAudit(tx, {
            jobId,
            contentId,
            provider,
            ownerMemberId: content.ownerMemberId,
            moderationOutcome: 'REJECTED',
            toPublishStatus: ContentPublishStatus.MACHINE_REJECTED,
          });
          await this.notifyOwnerModerationOutcomeTx(tx, {
            contentId,
            ownerMemberId: content.ownerMemberId,
            outcome: 'REJECTED',
          });
          return;
        }

        if (verdict === 'suspicious') {
          await tx.moderationJob.update({
            where: { id: jobId },
            data: {
              state: ModerationJobState.COMPLETED,
              resultPayload: {
                outcome: 'SUSPICIOUS',
                provider,
                async: true,
              },
            },
          });
          await tx.content.update({
            where: { id: contentId },
            data: {
              publishStatus: ContentPublishStatus.SUSPICIOUS_PUBLISHED,
              listingState: ContentListingState.NORMAL,
            },
          });
          await this.appendModerationOutcomeAudit(tx, {
            jobId,
            contentId,
            provider,
            ownerMemberId: content.ownerMemberId,
            moderationOutcome: 'SUSPICIOUS',
            toPublishStatus: ContentPublishStatus.SUSPICIOUS_PUBLISHED,
          });
          await this.notifyOwnerModerationOutcomeTx(tx, {
            contentId,
            ownerMemberId: content.ownerMemberId,
            outcome: 'SUSPICIOUS',
          });
          return;
        }

        await tx.moderationJob.update({
          where: { id: jobId },
          data: {
            state: ModerationJobState.COMPLETED,
            resultPayload: {
              outcome: 'APPROVED',
              provider,
              async: true,
            },
          },
        });

        await tx.content.update({
          where: { id: contentId },
          data: {
            publishStatus: ContentPublishStatus.PUBLISHED,
            listingState: ContentListingState.NORMAL,
          },
        });
        await this.appendModerationOutcomeAudit(tx, {
          jobId,
          contentId,
          provider,
          ownerMemberId: content.ownerMemberId,
          moderationOutcome: 'APPROVED',
          toPublishStatus: ContentPublishStatus.PUBLISHED,
        });
        await this.notifyOwnerModerationOutcomeTx(tx, {
          contentId,
          ownerMemberId: content.ownerMemberId,
          outcome: 'APPROVED',
        });
      });
    } catch (err) {
      this.logger.warn(
        `job ${jobId} process error: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.failJob(jobId, 'transaction_failed');
    }
  }

  /** Owner 存在且站内渠道未关时写入 **`in_app_notifications`**（与机审同事务）。 */
  private async notifyOwnerModerationOutcomeTx(
    tx: Prisma.TransactionClient,
    row: {
      contentId: string;
      ownerMemberId: string | null;
      outcome: 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
    },
  ): Promise<void> {
    if (!row.ownerMemberId) {
      return;
    }
    if (row.outcome === 'REJECTED') {
      await this.inAppNotificationDispatch.enqueueForMemberTx(tx, {
        memberId: row.ownerMemberId,
        category: InAppNotificationCategory.CONTENT_MODERATION_REJECTED,
        title: '机审未通过',
        body: '您提交的内容未通过自动审核，可修改后重新提交。',
        data: {
          contentId: row.contentId,
          publishStatus: ContentPublishStatus.MACHINE_REJECTED,
        },
      });
      return;
    }
    if (row.outcome === 'SUSPICIOUS') {
      await this.inAppNotificationDispatch.enqueueForMemberTx(tx, {
        memberId: row.ownerMemberId,
        category: InAppNotificationCategory.CONTENT_MODERATION_SUSPICIOUS,
        title: '内容已发布（待复核）',
        body: '您提交的内容已上线，平台将进行进一步复核。',
        data: {
          contentId: row.contentId,
          publishStatus: ContentPublishStatus.SUSPICIOUS_PUBLISHED,
        },
      });
      return;
    }
    await this.inAppNotificationDispatch.enqueueForMemberTx(tx, {
      memberId: row.ownerMemberId,
      category: InAppNotificationCategory.CONTENT_MODERATION_APPROVED,
      title: '内容已发布',
      body: '您提交的内容已通过审核并已发布。',
      data: {
        contentId: row.contentId,
        publishStatus: ContentPublishStatus.PUBLISHED,
      },
    });
  }

  /** PRD §13.2「机审结果写入」：`actor*` 为空表示非 HTTP 人类会话。 */
  private async appendModerationOutcomeAudit(
    tx: Prisma.TransactionClient,
    row: {
      jobId: string;
      contentId: string;
      provider: string;
      ownerMemberId: string | null;
      moderationOutcome: 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
      toPublishStatus: ContentPublishStatus;
    },
  ): Promise<void> {
    await appendAuditLogDetached(tx, {
      action: AuditAction.CONTENT_MODERATION_OUTCOME,
      targetType: 'Content',
      targetId: row.contentId,
      actorUserId: null,
      actorMemberId: null,
      payload: {
        jobId: row.jobId,
        provider: row.provider,
        moderationOutcome: row.moderationOutcome,
        toPublishStatus: row.toPublishStatus,
        ownerMemberId: row.ownerMemberId,
      },
    });
  }

  private async failJob(jobId: string, reason: string): Promise<void> {
    await this.prisma.moderationJob.updateMany({
      where: { id: jobId, state: ModerationJobState.PROCESSING },
      data: {
        state: ModerationJobState.FAILED,
        resultPayload: { outcome: 'FAILED', reason },
      },
    });
  }
}
