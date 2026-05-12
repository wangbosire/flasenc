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

export type PlatformContentAdminDetail = PlatformContentListing & {
  title: string | null
  body: unknown
  placeholderKind: string
  ownerMemberId: string | null
  entitlementId: string | null
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

function pageSearch(query: PageQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
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
): Promise<PlatformContentListing> {
  return adminSessionRequest<PlatformContentListing>(
    `/admin/v1/contents/${encodeURIComponent(contentId)}/actions/${action}`,
    { method: 'POST' }
  )
}
