import { adminApiOrigin } from '../lib/admin-api-origin';

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  traceId: string;
};

export type ApiFailureEnvelope = {
  success: false;
  error: { code: string; message: string; details: unknown };
  traceId: string;
};

/** 与规范信封一致；分支逻辑以 {@link ApiFailureEnvelope.error.code} 为准。 */
export class AdminApiError extends Error {
  readonly code: string;

  readonly traceId: string;

  readonly httpStatus: number;

  readonly details: unknown;

  constructor(httpStatus: number, body: ApiFailureEnvelope) {
    super(body.error.message);
    this.name = 'AdminApiError';
    this.code = body.error.code;
    this.traceId = body.traceId;
    this.httpStatus = httpStatus;
    this.details = body.error.details;
  }
}

type AdminFetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
  /** 已登录接口传入 **`Bearer`**。 */
  accessToken?: string;
};

/**
 * 唯一 HTTP 出口：统一 **`X-Request-Id`**、**`Accept`**、JSON **`Content-Type`**（有 body 时）、**`Authorization`**，并解析成功/失败信封。
 */
export async function adminRequest<T>(
  path: string,
  options: AdminFetchOptions = {},
): Promise<T> {
  const origin = adminApiOrigin();
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const url = origin.length > 0 ? `${origin}${pathPart}` : pathPart;
  const { accessToken, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set('Accept', 'application/json');
  if (rest.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  headers.set('X-Request-Id', crypto.randomUUID());
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(url, { ...rest, headers });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`响应非 JSON（HTTP ${res.status}）`);
  }

  if (!json || typeof json !== 'object' || !('success' in json)) {
    throw new Error('响应不符合统一信封');
  }

  const envelope = json as ApiSuccessEnvelope<T> | ApiFailureEnvelope;
  if (envelope.success === false) {
    throw new AdminApiError(res.status, envelope);
  }
  return envelope.data;
}
