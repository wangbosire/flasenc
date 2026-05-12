import { adminRefresh } from './admin-auth'
import { AdminApiError, adminRequest } from './http'
import { useAuthStore } from '@/stores/auth-store'

type SessionRequestOptions = Parameters<typeof adminRequest>[1]

/**
 * 管理端鉴权请求统一入口：优先使用 access token，遇到会话过期类错误时用 refresh token 轮换并重试一次。
 */
export async function adminSessionRequest<T>(
  path: string,
  options: SessionRequestOptions = {}
): Promise<T> {
  const auth = useAuthStore.getState().auth
  const run = (accessToken: string) =>
    adminRequest<T>(path, { ...options, accessToken })

  try {
    return await run(auth.accessToken)
  } catch (err) {
    if (!shouldRefresh(err) || !auth.refreshToken) {
      throw err
    }

    // Refresh token 只在 access token 失效时使用；成功后立即更新 store/cookie，避免后续请求继续携带旧 token。
    const next = await adminRefresh(auth.refreshToken)
    auth.setAccessToken(next.accessToken)
    auth.setRefreshToken(next.refreshToken)
    return run(next.accessToken)
  }
}

function shouldRefresh(err: unknown): boolean {
  return (
    err instanceof AdminApiError &&
    (err.httpStatus === 401 || err.code === 'AUTH_INVALID_TOKEN')
  )
}
