import { useQuery } from '@tanstack/react-query'
import { getAdminMenuTree } from '@/api/admin-menu'
import { sidebarData } from '@/components/layout/data/sidebar-data'
import { adminMenuTreeToSidebarData } from '@/lib/admin-menu-map'

export const adminMenuQueryKey = ['admin', 'menu-items', 'tree'] as const

export function useAdminSidebarData() {
  return useQuery({
    queryKey: adminMenuQueryKey,
    queryFn: getAdminMenuTree,
    select: (tree) => adminMenuTreeToSidebarData(tree, sidebarData),
    // 菜单是后台配置，短时间内变化频率低；变更页会主动 invalidate。
    staleTime: 60 * 1000,
    placeholderData: [],
  })
}

export function useResolvedAdminSidebarData() {
  const query = useAdminSidebarData()
  return {
    ...query,
    sidebarData: query.data?.navGroups.length ? query.data : sidebarData,
  }
}
