import { adminRequest } from './http';

/** 与 Nest `PlatformContentAdminDetailDto` 对齐；`body` 为内容域 JSON，边界处保持 `unknown`。 */
export type PlatformContentAdminDetail = {
  id: string;
  title: string | null;
  body: unknown;
  publishStatus: string;
  listingState: string;
  placeholderKind: string;
  ownerMemberId: string | null;
  entitlementId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function getContentAdminDetail(
  contentId: string,
  accessToken: string,
): Promise<PlatformContentAdminDetail> {
  const path = `/admin/v1/contents/${encodeURIComponent(contentId)}`;
  return adminRequest<PlatformContentAdminDetail>(path, {
    method: 'GET',
    accessToken,
  });
}
