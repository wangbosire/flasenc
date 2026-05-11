/**
 * MVP：`provider=noop` 时机审结果由本开关驱动，便于联调 / E2E；接入真实供应商后仅对 noop 生效。
 *
 * - `approve`（默认）：`PUBLISHED` + `NORMAL`
 * - `reject`：`MACHINE_REJECTED`（访客不可当「正常已发布」读）
 * - `suspicious`：`SUSPICIOUS_PUBLISHED` + `NORMAL`（PRD：先发布并进平台队列）
 */
export type NoopModerationOutcome = 'approve' | 'reject' | 'suspicious';

const ENV_KEY = 'CONTENT_MODERATION_NOOP_OUTCOME';

export function readNoopModerationOutcomeFromEnv(): NoopModerationOutcome {
  const raw = process.env[ENV_KEY]?.trim().toLowerCase();
  if (raw === 'reject' || raw === 'rejected') {
    return 'reject';
  }
  if (raw === 'suspicious' || raw === 'flag') {
    return 'suspicious';
  }
  if (
    raw === undefined ||
    raw === '' ||
    raw === 'approve' ||
    raw === 'pass' ||
    raw === 'approved'
  ) {
    return 'approve';
  }
  // 未知取值：保守按通过处理，避免误杀线上内容。
  return 'approve';
}
