import { adminRequest } from './http'
import type { PlatformContentAdminDetail } from './platform-contents'

export type { PlatformContentAdminDetail }

export function getContentAdminDetail(
  contentId: string,
  accessToken: string
): Promise<PlatformContentAdminDetail> {
  const path = `/admin/v1/contents/${encodeURIComponent(contentId)}`
  return adminRequest<PlatformContentAdminDetail>(path, {
    method: 'GET',
    accessToken,
  })
}
