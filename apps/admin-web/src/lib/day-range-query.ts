import { endOfDay, parse, startOfDay } from 'date-fns'
import type { DayRangeValue } from '@/components/date-range-picker'

/** 将日历 `yyyy-MM-dd` 区间写入查询对象（本地日起点为 00:00，末日终点为 23:59:59.999）。 */
export function assignIsoBoundsFromDayRange<Q extends Record<string, unknown>>(
  q: Q,
  range: DayRangeValue,
  fromKey: keyof Q,
  toKey: keyof Q
): void {
  if (!range?.from) return
  const fromDate = startOfDay(parse(range.from, 'yyyy-MM-dd', new Date()))
  const endStr = range.to ?? range.from
  const toDate = endOfDay(parse(endStr, 'yyyy-MM-dd', new Date()))
  ;(q as Record<string, string>)[fromKey as string] = fromDate.toISOString()
  ;(q as Record<string, string>)[toKey as string] = toDate.toISOString()
}
