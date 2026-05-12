import { type NavItem, type SidebarData } from '@/components/layout/types'
import { type AdminMenuTreeItem } from '@/api/admin-menu'
import { resolveAdminMenuIcon } from './admin-menu-icons'

export function adminMenuTreeToSidebarData(
  tree: AdminMenuTreeItem[],
  base: Pick<SidebarData, 'user' | 'teams'>
): SidebarData {
  return {
    ...base,
    navGroups: tree
      .filter((group) => !group.routePath)
      .map((group) => ({
        title: group.title,
        items: group.children.flatMap<NavItem>((item) => {
          if (item.routePath) {
            return [
              {
                title: item.title,
                url: item.routePath,
                icon: resolveAdminMenuIcon(item.iconKey),
              },
            ]
          }

          const children = item.children
            .filter((child) => child.routePath)
            .map((child) => ({
              title: child.title,
              url: child.routePath!,
              icon: resolveAdminMenuIcon(child.iconKey),
            }))

          if (!children.length) return []
          return [
            {
              title: item.title,
              icon: resolveAdminMenuIcon(item.iconKey),
              items: children,
            },
          ]
        }),
      }))
      .filter((group) => group.items.length > 0),
  }
}
