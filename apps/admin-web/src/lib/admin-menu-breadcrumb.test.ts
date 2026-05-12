import { describe, expect, it } from 'vitest'
import type { AdminMenuTreeItem } from '@/api/admin-menu'
import { resolveAdminMenuBreadcrumbTitles } from '@/lib/admin-menu-breadcrumb'

function item(
  partial: Pick<AdminMenuTreeItem, 'title' | 'routePath'> &
    Partial<Omit<AdminMenuTreeItem, 'title' | 'routePath' | 'children'>>,
  children: AdminMenuTreeItem[] = [],
): AdminMenuTreeItem {
  return {
    id: partial.title,
    parentId: null,
    iconKey: null,
    sortOrder: 0,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    children,
    ...partial,
  }
}

describe('resolveAdminMenuBreadcrumbTitles', () => {
  it('returns group / leaf titles for exact path', () => {
    const tree: AdminMenuTreeItem[] = [
      item({ title: '运营', routePath: null }, [
        item({ title: '内容列表', routePath: '/contents' }),
      ]),
    ]
    expect(resolveAdminMenuBreadcrumbTitles(tree, '/contents')).toEqual([
      '运营',
      '内容列表',
    ])
  })

  it('prefers longer routePath when pathname is nested', () => {
    const tree: AdminMenuTreeItem[] = [
      item({ title: '根', routePath: null }, [
        item({ title: '设置', routePath: '/settings' }, [
          item({ title: '账号', routePath: '/settings/account' }),
        ]),
      ]),
    ]
    expect(
      resolveAdminMenuBreadcrumbTitles(tree, '/settings/account'),
    ).toEqual(['根', '设置', '账号'])
  })

  it('matches home only exactly', () => {
    const tree: AdminMenuTreeItem[] = [
      item({ title: '总览', routePath: '/' }),
      item({ title: '其它', routePath: '/tasks' }),
    ]
    expect(resolveAdminMenuBreadcrumbTitles(tree, '/')).toEqual(['总览'])
    expect(resolveAdminMenuBreadcrumbTitles(tree, '/tasks')).toEqual(['其它'])
  })

  it('returns null when nothing matches', () => {
    const tree: AdminMenuTreeItem[] = [
      item({ title: 'A', routePath: '/a' }),
    ]
    expect(resolveAdminMenuBreadcrumbTitles(tree, '/unknown')).toBeNull()
  })

  it('ignores external routePath', () => {
    const tree: AdminMenuTreeItem[] = [
      item({ title: '外站', routePath: 'https://example.com' }),
    ]
    expect(resolveAdminMenuBreadcrumbTitles(tree, '/')).toBeNull()
  })
})
