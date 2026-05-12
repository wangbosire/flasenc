import { UserButton } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { getAdminMenuTree } from '@/api/admin-menu'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { adminMenuQueryKey } from '@/hooks/use-admin-menu'
import { authenticatedPageTitle } from '@/lib/authenticated-page-title'
import { resolveAdminMenuBreadcrumbTitles } from '@/lib/admin-menu-breadcrumb'
import { cn } from '@/lib/utils'

/**
 * 认证区统一顶栏：标题优先由后台菜单树解析（全路径），其余路由走本地兜底。
 */
export function AuthenticatedChrome() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })
  const menuTreeQuery = useQuery({
    queryKey: adminMenuQueryKey,
    queryFn: getAdminMenuTree,
    staleTime: 60 * 1000,
  })
  const menuTitles = menuTreeQuery.data
    ? resolveAdminMenuBreadcrumbTitles(menuTreeQuery.data, pathname)
    : null
  const title =
    menuTitles?.length ? menuTitles.join(' / ') : authenticatedPageTitle(pathname)
  const clerkShell = pathname.startsWith('/clerk/')
  const showGlobalSearch =
    pathname === '/' ||
    pathname.startsWith('/settings') ||
    pathname.includes('/errors/') ||
    clerkShell

  return (
    <>
      <Header
        fixed
        className={cn(pathname.includes('/errors/') && 'border-b')}
      >
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <h1
            className='min-w-0 truncate text-lg font-semibold'
            title={title}
          >
            {title}
          </h1>
          {showGlobalSearch ? (
            <Search
              className={
                pathname === '/'
                  ? undefined
                  : 'me-auto sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg'
              }
            />
          ) : null}
        </div>
        <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
          <ThemeSwitch />
          <ConfigDrawer />
          {clerkShell ? <UserButton /> : <ProfileDropdown />}
        </div>
      </Header>
      <Outlet />
    </>
  )
}
