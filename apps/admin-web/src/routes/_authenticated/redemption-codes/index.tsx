import { createFileRoute } from '@tanstack/react-router'
import { RedemptionCodes } from '@/features/redemption-codes'

export const Route = createFileRoute('/_authenticated/redemption-codes/')({
  component: RedemptionCodes,
})
