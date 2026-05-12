import { adminSessionRequest } from './admin-session'

export type AuditLogItem = {
  id: string
  actorUserId: string | null
  actorMemberId: string | null
  action: string
  targetType: string
  targetId: string
  payload: unknown
  traceId: string | null
  createdAt: string
}

export type AuditLogPage = {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}

export type AuditLogQuery = {
  page: number
  pageSize: number
  action?: string
  targetType?: string
  targetId?: string
  from?: string
  to?: string
}

export function listAuditLogs(
  query: AuditLogQuery
): Promise<AuditLogPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  for (const key of ['action', 'targetType', 'targetId', 'from', 'to'] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  return adminSessionRequest<AuditLogPage>(`/admin/v1/audit-logs?${params}`, {
    method: 'GET',
  })
}
