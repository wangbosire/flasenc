import { toast } from 'sonner'
import { AdminApiError } from '@/api/http'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof AdminApiError && error.message.length > 0) {
    errMsg = error.message
  }

  toast.error(errMsg)
}
