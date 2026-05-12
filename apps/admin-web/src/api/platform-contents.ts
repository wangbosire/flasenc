import { adminSessionRequest } from './admin-session'

export type PlatformContentListing = {
  id: string
  publishStatus: string
  listingState: string
}

export type SuspiciousPublishedQueueItem = PlatformContentListing & {
  title: string | null
  ownerMemberId: string | null
  entitlementId: string | null
  createdAt: string
  updatedAt: string
}

export type SuspiciousPublishedQueuePage = {
  items: SuspiciousPublishedQueueItem[]
  total: number
  page: number
  pageSize: number
}

export type PlatformContentRedemptionCode = {
  id: string
  /** C 端兑换输入明文；历史码未落库时为空。 */
  plainCode: string | null
  status: string
  createdAt: string
  invalidatedAt: string | null
  redeemedAt: string | null
}

/** 与后端 `PlatformContentEntitlementSnapshotDto` 对齐；与扁平 `entitlementId` / `redemptionCodes` 同源。 */
export type PlatformContentEntitlementSnapshot = {
  id: string
  contentId: string
  status: string
  createdAt: string
  updatedAt: string
  createdByUserId: string | null
  redemptionCodeCount: number
  redemptionCodes: PlatformContentRedemptionCode[]
}

export type PlatformContentListItem = SuspiciousPublishedQueueItem & {
  placeholderKind: string
  redemptionCodeCount: number
  redemptionCodes: PlatformContentRedemptionCode[]
  entitlement: PlatformContentEntitlementSnapshot | null
}

export type PlatformContentListPage = {
  items: PlatformContentListItem[]
  total: number
  page: number
  pageSize: number
}

export type PlatformContentAdminDetail = PlatformContentListing & {
  title: string | null
  body: unknown
  placeholderKind: string
  ownerMemberId: string | null
  entitlementId: string | null
  redemptionCodeCount: number
  redemptionCodes: PlatformContentRedemptionCode[]
  entitlement: PlatformContentEntitlementSnapshot | null
  createdAt: string
  updatedAt: string
}

export type ContentTransferRecordItem = {
  id: string
  contentId: string
  fromMemberId: string
  toMemberId: string | null
  method: string
  status: string
  expiresAt: string
  createdAt: string
  confirmedAt: string | null
  revokedAt: string | null
}

export type ContentTransferRecordsPage = {
  items: ContentTransferRecordItem[]
  total: number
  page: number
  pageSize: number
}

export type PageQuery = {
  page: number
  pageSize: number
}

/** `GET /admin/v1/contents` 可选筛选；空字段不传。 */
export type AdminContentListQuery = PageQuery & {
  contentId?: string
  publishStatus?: string
  listingState?: string
  placeholderKind?: string
  ownerMemberId?: string
  entitlementId?: string
  titleContains?: string
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  hasEntitlement?: boolean
  hasOwner?: boolean
  redemptionPlainContains?: string
  redemptionCodeId?: string
  redemptionCodeStatus?: string
}

function pageSearch(query: PageQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  return params.toString()
}

function adminContentListSearch(query: AdminContentListQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  const optionalKeys = [
    'contentId',
    'publishStatus',
    'listingState',
    'placeholderKind',
    'ownerMemberId',
    'entitlementId',
    'titleContains',
    'createdFrom',
    'createdTo',
    'updatedFrom',
    'updatedTo',
    'redemptionPlainContains',
    'redemptionCodeId',
    'redemptionCodeStatus',
  ] as const satisfies ReadonlyArray<keyof AdminContentListQuery>
  for (const key of optionalKeys) {
    const v = query[key]
    if (v === undefined || v === '') continue
    params.set(key, String(v))
  }
  if (query.hasEntitlement !== undefined) {
    params.set('hasEntitlement', query.hasEntitlement ? 'true' : 'false')
  }
  if (query.hasOwner !== undefined) {
    params.set('hasOwner', query.hasOwner ? 'true' : 'false')
  }
  return params.toString()
}

export function listSuspiciousPublishedQueue(
  query: PageQuery
): Promise<SuspiciousPublishedQueuePage> {
  return adminSessionRequest<SuspiciousPublishedQueuePage>(
    `/admin/v1/contents/queues/suspicious?${pageSearch(query)}`,
    { method: 'GET' }
  )
}

export function listPlatformContents(
  query: AdminContentListQuery
): Promise<PlatformContentListPage> {
  return adminSessionRequest<PlatformContentListPage>(
    `/admin/v1/contents?${adminContentListSearch(query)}`,
    { method: 'GET' }
  )
}

export function getContentAdminDetail(
  contentId: string
): Promise<PlatformContentAdminDetail> {
  return adminSessionRequest<PlatformContentAdminDetail>(
    `/admin/v1/contents/${encodeURIComponent(contentId)}`,
    { method: 'GET' }
  )
}

export function getContentTransferRecords(
  contentId: string,
  query: PageQuery
): Promise<ContentTransferRecordsPage> {
  return adminSessionRequest<ContentTransferRecordsPage>(
    `/admin/v1/contents/${encodeURIComponent(contentId)}/transfer-records?${pageSearch(query)}`,
    { method: 'GET' }
  )
}

export function applyContentAction(
  contentId: string,
  action:
    | 'unlist'
    | 'hide'
    | 'restore-listing'
    | 'clear-suspicion'
    | 'mark-manually-rejected'
    | 'submit-moderation'
): Promise<PlatformContentListing> {
  return adminSessionRequest<PlatformContentListing>(
    `/admin/v1/contents/${encodeURIComponent(contentId)}/actions/${action}`,
    { method: 'POST' }
  )
}

export function updateContentPermission(
  contentId: string,
  patch: { publishStatus?: string; listingState?: string }
): Promise<PlatformContentListing> {
  return adminSessionRequest<PlatformContentListing>(
    `/admin/v1/contents/${encodeURIComponent(contentId)}/permissions`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  )
}
