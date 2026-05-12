import { AdminApiError } from '@/api/http'

/** 管理端 toast / Alert 用的可读错误文案。 */
export function adminApiErrorMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    return `${err.code}: ${err.message}`
  }
  return err instanceof Error ? err.message : String(err)
}
