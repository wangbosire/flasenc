import { Injectable } from '@nestjs/common';
import { readNoopModerationOutcomeFromEnv } from './noop-moderation-outcome';

/** 与 `noop-moderation-outcome` 分支一致；供应商返回的粗粒度机审结论（写入 `Content` / Job）。 */
export type ContentModerationVerdict = 'approve' | 'reject' | 'suspicious';

/**
 * 对 **`CONTENT`** 机审任务在 claim 之后、写库之前给出结论；由 {@link ContentModerationProcessorService} 调用。
 * 接入 HTTP 供应商时可另建 `useClass` 实现，并在 {@link FrontModule} 中替换绑定。
 */
export abstract class ContentModerationOutcomeProvider {
  abstract decideContentOutcome(params: {
    provider: string;
    contentId: string;
  }): ContentModerationVerdict;
}

/** MVP：`provider=noop` 时读 **`CONTENT_MODERATION_NOOP_OUTCOME`**；其它 `provider` 暂默认通过。 */
@Injectable()
export class NoopContentModerationOutcomeProvider extends ContentModerationOutcomeProvider {
  decideContentOutcome(params: {
    provider: string;
    contentId: string;
  }): ContentModerationVerdict {
    if (params.provider !== 'noop') {
      return 'approve';
    }
    // noop 不读正文；`contentId` 供未来 HTTP 供应商拉取送审载荷时使用。
    void params.contentId;
    return readNoopModerationOutcomeFromEnv();
  }
}
