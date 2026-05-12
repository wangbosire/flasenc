import { createFileRoute } from '@tanstack/react-router'
import { Contents } from '@/features/contents'

export const Route = createFileRoute('/_authenticated/contents/')({
  component: Contents,
})
