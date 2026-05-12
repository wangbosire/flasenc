import {
  Bell,
  ClipboardList,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Menu,
  Monitor,
  Newspaper,
  Palette,
  Settings,
  ShieldAlert,
  UserCog,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const adminMenuIcons = {
  Bell,
  ClipboardList,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Menu,
  Monitor,
  Newspaper,
  Palette,
  Settings,
  ShieldAlert,
  UserCog,
  Wrench,
} satisfies Record<string, LucideIcon>

export type AdminMenuIconKey = keyof typeof adminMenuIcons

export const adminMenuIconOptions = Object.entries(adminMenuIcons).map(
  ([key, Icon]) => ({
    Icon,
    key,
    label: key,
  })
)

export function resolveAdminMenuIcon(key: string | null) {
  if (!key) return undefined
  return adminMenuIcons[key as AdminMenuIconKey] ?? Menu
}
