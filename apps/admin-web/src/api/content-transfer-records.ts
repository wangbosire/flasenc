import { adminRequest } from './http';

export type ContentTransferRecordItem = {
  id: string;
  contentId: string;
  fromMemberId: string;
  toMemberId: string | null;
  method: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  revokedAt: string | null;
};

export type ContentTransferRecordsPage = {
  items: ContentTransferRecordItem[];
  total: number;
  page: number;
  pageSize: number;
};

export function getContentTransferRecords(
  contentId: string,
  accessToken: string,
  query?: { page?: number; pageSize?: number },
): Promise<ContentTransferRecordsPage> {
  const q = new URLSearchParams();
  if (query?.page !== undefined) {
    q.set('page', String(query.page));
  }
  if (query?.pageSize !== undefined) {
    q.set('pageSize', String(query.pageSize));
  }
  const qs = q.toString();
  const path = `/admin/v1/contents/${encodeURIComponent(contentId)}/transfer-records${qs ? `?${qs}` : ''}`;
  return adminRequest<ContentTransferRecordsPage>(path, {
    method: 'GET',
    accessToken,
  });
}
