import { transferExpiresAtShanghai } from './transfer-expires';

describe('transferExpiresAtShanghai', () => {
  it('以 start 所在 UTC+8 日历日为第 1 日，返回第 7 日 23:59:59.999（东八区）对应的 UTC 时刻', () => {
    const start = new Date('2026-05-12T08:30:00.000Z');
    const exp = transferExpiresAtShanghai(start);
    expect(exp.toISOString()).toBe('2026-05-18T15:59:59.999Z');
  });

  it('UTC 日界跨东八区「换日」时，第 1 日按东八区日历计', () => {
    // 东八区已为 5 月 13 日 00:00 → 第 1 日为 5 月 13 日，第 7 日截止为 5 月 19 日 23:59:59.999 +0800
    const start = new Date('2026-05-12T16:00:00.000Z');
    const exp = transferExpiresAtShanghai(start);
    expect(exp.toISOString()).toBe('2026-05-19T15:59:59.999Z');
  });
});
