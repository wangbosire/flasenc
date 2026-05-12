import type { AdminMenuTreeItem } from '@/api/admin-menu'

function normalizePathname(pathname: string): string {
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

/** 仅站内路径参与 pathname 匹配（外链菜单项不会命中浏览器 pathname）。 */
function isInternalRoutePath(routePath: string): boolean {
  return routePath.startsWith('/')
}

type BestMatch = { segments: string[]; score: number }

function pickBetter(a: BestMatch | null, b: BestMatch | null): BestMatch | null {
  if (!a) return b
  if (!b) return a
  return b.score > a.score ? b : a
}

/**
 * `routePath` 是否与当前 URL 对应：
 * - 精确相等，或
 * - `pathname` 为该路由下的子路径（更长 `routePath` 优先于外层菜单）。
 *
 * 特例：`/` 仅精确匹配，避免「首页」吞掉所有站内路径。
 */
function routeMatchesPathname(normPathname: string, routePath: string): boolean {
  const r = normalizePathname(routePath)
  if (!isInternalRoutePath(r)) return false
  if (normPathname === r) return true
  if (r === '/') return false
  return normPathname.startsWith(`${r}/`)
}

function scoreForRoute(routePath: string): number {
  return normalizePathname(routePath).length
}

function dfsBestMatch(
  nodes: AdminMenuTreeItem[],
  normPathname: string,
  ancestorTitles: string[],
): BestMatch | null {
  let best: BestMatch | null = null

  for (const node of nodes) {
    const titles = [...ancestorTitles, node.title]

    if (node.routePath && routeMatchesPathname(normPathname, node.routePath)) {
      best = pickBetter(best, {
        segments: titles,
        score: scoreForRoute(node.routePath),
      })
    }

    if (node.children?.length) {
      best = pickBetter(best, dfsBestMatch(node.children, normPathname, titles))
    }
  }

  return best
}

/**
 * 从后台返回的启用菜单树解析当前 pathname 的**全路径标题**（自根分组起各级 `title`）。
 * 无匹配（例如错误页、未收录路由）时返回 `null`，由调用方使用本地兜底文案。
 */
export function resolveAdminMenuBreadcrumbTitles(
  tree: AdminMenuTreeItem[],
  pathname: string,
): string[] | null {
  const norm = normalizePathname(pathname)
  const best = dfsBestMatch(tree, norm, [])
  return best?.segments ?? null
}
