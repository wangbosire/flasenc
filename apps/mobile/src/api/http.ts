import type { ApiError } from './types'

const ACCESS_TOKEN_KEY = 'memberAccessToken'
const REFRESH_TOKEN_KEY = 'memberRefreshToken'

export class MobileApiError extends Error {
  code: string
  statusCode: number
  details: unknown

  constructor(statusCode: number, error: ApiError) {
    super(error.message ?? error.code ?? `HTTP ${statusCode}`)
    this.name = 'MobileApiError'
    this.statusCode = statusCode
    this.code = error.code ?? 'HTTP_ERROR'
    this.details = error.details
  }
}

export function getAccessToken(): string {
  return String(uni.getStorageSync(ACCESS_TOKEN_KEY) || '')
}

export function saveTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  if (tokens.accessToken) {
    uni.setStorageSync(ACCESS_TOKEN_KEY, tokens.accessToken)
  }
  if (tokens.refreshToken) {
    uni.setStorageSync(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }
}

export function clearTokens() {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/$/, '')
}

export function hasApiBase(): boolean {
  return apiBase().length > 0
}

function buildQuery(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) {
    return ''
  }
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return params.length ? `?${params.join('&')}` : ''
}

export async function apiRequest<T>(options: {
  path: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: unknown
  query?: Record<string, string | number | boolean | undefined>
  auth?: boolean
}): Promise<T> {
  const base = apiBase()
  if (!base) {
    throw new MobileApiError(0, {
      code: 'MOBILE_API_BASE_MISSING',
      message: '请先配置 VITE_API_BASE',
    })
  }

  const token = getAccessToken()
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': `mobile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }
  if (options.auth !== false && token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${base}${options.path}${buildQuery(options.query)}`,
      method: (options.method ?? 'GET') as UniApp.RequestOptions['method'],
      header,
      data: options.data as UniApp.RequestOptions['data'],
      success: (res) => {
        const body = res.data as { success?: boolean; data?: T; error?: ApiError } | T
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (typeof body === 'object' && body !== null && 'success' in body) {
            const enveloped = body as { success?: boolean; data?: T; error?: ApiError }
            if (enveloped.success === false) {
              reject(new MobileApiError(res.statusCode, enveloped.error ?? {}))
              return
            }
            resolve(enveloped.data as T)
            return
          }
          resolve(body as T)
          return
        }
        const error =
          typeof body === 'object' && body !== null && 'error' in body
            ? (body as { error?: ApiError }).error
            : undefined
        reject(new MobileApiError(res.statusCode, error ?? { message: `HTTP ${res.statusCode}` }))
      },
      fail: (error) => reject(error),
    })
  })
}
