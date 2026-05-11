import { Injectable } from '@nestjs/common';
import {
  ModerationJobState,
  ModerationSubjectType,
  type Prisma,
} from '@prisma/client';

/**
 * 内容发布机审接入面：HTTP 事务内 **仅入队**（`ModerationJob`=`QUEUED`）。
 * 终态由 {@link ContentModerationProcessorService}（定时拉取）或未来供应商 webhook 写入。
 */
@Injectable()
export class ContentPublishModerationService {
  /**
   * 假定调用方已将对应 `Content` 置为 **`SUBMITTED`**；此处仅创建待消费的 `ModerationJob`。
   */
  async enqueuePublishJob(
    tx: Prisma.TransactionClient,
    contentId: string,
  ): Promise<void> {
    await tx.moderationJob.create({
      data: {
        subjectType: ModerationSubjectType.CONTENT,
        contentId,
        provider: 'noop',
        state: ModerationJobState.QUEUED,
      },
    });
  }
}
