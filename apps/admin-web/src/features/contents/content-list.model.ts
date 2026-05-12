import type { AdminContentListQuery } from '@/api/platform-contents'
import { assignIsoBoundsFromDayRange } from '@/lib/day-range-query'
import type { DayRangeValue } from '@/components/date-range-picker'

export const CONTENT_LIST_PAGE_SIZE = 10

/** 与筛选网格一致；lg 三列时两行对应 6 个字段。 */
export const CONTENT_FILTER_GRID_CLASS =
  'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'

export const PUBLISH_STATUS_OPTIONS = [
  'DRAFT',
  'SUBMITTED',
  'PUBLISHED',
  'MACHINE_REJECTED',
  'SUSPICIOUS_PUBLISHED',
  'MANUALLY_REJECTED',
] as const

export const LISTING_STATE_OPTIONS = [
  'NORMAL',
  'PLATFORM_UNLISTED',
  'EMERGENCY_HIDDEN',
] as const

export const REDEMPTION_CODE_STATUS_OPTIONS = [
  'ACTIVE',
  'INVALIDATED',
  'REDEEMED',
] as const

export const PLACEHOLDER_KIND_OPTIONS = ['PLACEHOLDER', 'OWNED'] as const

export type ContentListFilterDraft = {
  contentId: string
  publishStatus: string
  listingState: string
  placeholderKind: string
  ownerMemberId: string
  entitlementId: string
  titleContains: string
  createdRange: DayRangeValue
  updatedRange: DayRangeValue
  hasEntitlement: '' | 'true' | 'false'
  hasOwner: '' | 'true' | 'false'
  redemptionPlainContains: string
  redemptionCodeId: string
  redemptionCodeStatus: string
}

export const EMPTY_CONTENT_FILTERS: ContentListFilterDraft = {
  contentId: '',
  publishStatus: '',
  listingState: '',
  placeholderKind: '',
  ownerMemberId: '',
  entitlementId: '',
  titleContains: '',
  createdRange: null,
  updatedRange: null,
  hasEntitlement: '',
  hasOwner: '',
  redemptionPlainContains: '',
  redemptionCodeId: '',
  redemptionCodeStatus: '',
}

export const CONTENT_STATUS_LABELS = {
  publishStatus: {
    DRAFT: '草稿',
    SUBMITTED: '审核中',
    PUBLISHED: '已发布',
    MACHINE_REJECTED: '机审拒绝',
    SUSPICIOUS_PUBLISHED: '疑似已发布',
    MANUALLY_REJECTED: '人工拒绝',
  },
  listingState: {
    NORMAL: '正常上架',
    PLATFORM_UNLISTED: '平台下架',
    EMERGENCY_HIDDEN: '紧急隐藏',
  },
  placeholderKind: {
    PLACEHOLDER: '占位内容',
    OWNED: '已持有',
  },
  redemptionCodeStatus: {
    ACTIVE: '可兑换',
    INVALIDATED: '已作废',
    REDEEMED: '已兑换',
  },
} as const

export type ContentStatusKind = keyof typeof CONTENT_STATUS_LABELS

export function draftToListQuery(
  page: number,
  pageSize: number,
  d: ContentListFilterDraft
): AdminContentListQuery {
  const q: AdminContentListQuery = { page, pageSize }
  if (d.contentId.trim()) q.contentId = d.contentId.trim()
  if (d.publishStatus) q.publishStatus = d.publishStatus
  if (d.listingState) q.listingState = d.listingState
  if (d.placeholderKind) q.placeholderKind = d.placeholderKind
  if (d.ownerMemberId.trim()) q.ownerMemberId = d.ownerMemberId.trim()
  if (d.entitlementId.trim()) q.entitlementId = d.entitlementId.trim()
  if (d.titleContains.trim()) q.titleContains = d.titleContains.trim()
  assignIsoBoundsFromDayRange(q, d.createdRange, 'createdFrom', 'createdTo')
  assignIsoBoundsFromDayRange(q, d.updatedRange, 'updatedFrom', 'updatedTo')
  if (d.hasEntitlement === 'true') q.hasEntitlement = true
  if (d.hasEntitlement === 'false') q.hasEntitlement = false
  if (d.hasOwner === 'true') q.hasOwner = true
  if (d.hasOwner === 'false') q.hasOwner = false
  if (d.redemptionPlainContains.trim()) {
    q.redemptionPlainContains = d.redemptionPlainContains.trim()
  }
  if (d.redemptionCodeId.trim()) q.redemptionCodeId = d.redemptionCodeId.trim()
  if (d.redemptionCodeStatus) q.redemptionCodeStatus = d.redemptionCodeStatus
  return q
}
