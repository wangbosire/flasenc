import { adminRequest } from './http';

/** 与 **`POST /admin/v1/auth/login`**、**`POST /admin/v1/auth/refresh`** 响应 **`data`** 对齐。 */
export type AdminLoginResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  userId: string;
};

export function adminLogin(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  return adminRequest<AdminLoginResult>('/admin/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function adminRefresh(refreshToken: string): Promise<AdminLoginResult> {
  return adminRequest<AdminLoginResult>('/admin/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
