/**
 * 转让单 **`expiresAt`**：以 **`start`** 时刻所在 **UTC+8 日历日** 为第 1 日，返回 **第 7 个自然日** 的 **23:59:59.999**（与 `content-sharing-platform-technical-design.md` §5.2 一致）。
 * 当前实现为 **固定东八区**；若需完整 IANA（含历史 DST），应在配置层引入时区库后再替换本函数。
 */
export function transferExpiresAtShanghai(start: Date): Date {
  const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const shifted = start.getTime() + SHANGHAI_OFFSET_MS;
  const dayIndex = Math.floor(shifted / DAY_MS);
  const day1MidnightUtc = dayIndex * DAY_MS - SHANGHAI_OFFSET_MS;
  return new Date(day1MidnightUtc + 7 * DAY_MS - 1);
}
