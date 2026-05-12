import { describe, expect, it } from 'vitest'
import { type SidebarData } from '@/components/layout/types'
import { type AdminMenuTreeItem } from '@/api/admin-menu'
import { adminMenuTreeToSidebarData } from './admin-menu-map'

const base: Pick<SidebarData, 'user' | 'teams'> = {
  user: {
    name: 'Tester',
    email: 'tester@example.com',
    avatar: '/avatar.png',
  },
  teams: [],
}

function item(
  partial: Partial<AdminMenuTreeItem> & Pick<AdminMenuTreeItem, 'id' | 'title'>
): AdminMenuTreeItem {
  return {
    parentId: null,
    routePath: null,
    iconKey: null,
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    children: [],
    ...partial,
  }
}

describe('adminMenuTreeToSidebarData', () => {
  it('将后端菜单树映射为侧栏分组、链接和折叠项', () => {
    const sidebar = adminMenuTreeToSidebarData(
      [
        item({
          id: 'g1',
          title: '系统管理',
          children: [
            item({
              id: 'm1',
              parentId: 'g1',
              title: '菜单管理',
              routePath: '/system/menus',
              iconKey: 'Menu',
            }),
            item({
              id: 'c1',
              parentId: 'g1',
              title: '设置',
              iconKey: 'Settings',
              children: [
                item({
                  id: 's1',
                  parentId: 'c1',
                  title: '账号',
                  routePath: '/settings/account',
                  iconKey: 'Wrench',
                }),
              ],
            }),
          ],
        }),
      ],
      base
    )

    expect(sidebar.navGroups).toHaveLength(1)
    expect(sidebar.navGroups[0].items[0]).toMatchObject({
      title: '菜单管理',
      url: '/system/menus',
    })
    expect(sidebar.navGroups[0].items[1]).toMatchObject({
      title: '设置',
      items: [{ title: '账号', url: '/settings/account' }],
    })
  })

  it('保留自定义链接并过滤空折叠项', () => {
    const sidebar = adminMenuTreeToSidebarData(
      [
        item({
          id: 'g1',
          title: '测试',
          children: [
            item({
              id: 'bad',
              parentId: 'g1',
              title: '自定义链接',
              routePath: '/missing',
            }),
            item({
              id: 'empty',
              parentId: 'g1',
              title: '空折叠',
              children: [],
            }),
          ],
        }),
      ],
      base
    )

    expect(sidebar.navGroups).toHaveLength(1)
    expect(sidebar.navGroups[0].items).toEqual([
      expect.objectContaining({ title: '自定义链接', url: '/missing' }),
    ])
  })
})
