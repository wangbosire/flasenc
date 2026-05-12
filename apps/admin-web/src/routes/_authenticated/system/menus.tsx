import { createFileRoute } from '@tanstack/react-router'
import { MenuManagement } from '@/features/menu-management'

export const Route = createFileRoute('/_authenticated/system/menus')({
  component: MenuManagement,
})
