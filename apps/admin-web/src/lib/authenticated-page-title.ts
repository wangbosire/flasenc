/** `/errors/:segment` 对应顶栏短标题 */
const ERROR_SEGMENT_LABELS: Record<string, string> = {
  unauthorized: '未登录',
  forbidden: '无权访问',
  'not-found': '未找到',
  'internal-server-error': '服务器错误',
  'maintenance-error': '维护中',
}

/**
 * 更长路径优先：用于 `/settings/account` 等子页面覆盖 `/settings`。
 * （数组顺序即匹配优先级，勿随意打乱。）
 */
const PREFIX_TITLES: readonly (readonly [string, string])[] = [
  ['/settings/notifications', '通知'],
  ['/settings/display', '显示'],
  ['/settings/appearance', '外观'],
  ['/settings/account', '账号'],
  ['/settings', '设置'],
  ['/system/menus', '菜单管理'],
  ['/redemption-codes', '生成兑换码'],
  ['/contents', '内容列表'],
  ['/tasks', '内容复核'],
  ['/users', '审计与追踪'],
  ['/help-center', '帮助中心'],
  ['/chats', '收件箱'],
  ['/apps', '权益发放'],
]

function normalizePathname(pathname: string): string {
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * 顶栏标题兜底：菜单树未命中时使用（如 `/errors/*`、`/clerk/*`、未入库路由等）。
 */
export function authenticatedPageTitle(pathname: string): string {
  const path = normalizePathname(pathname)

  const errMatch = /^\/errors\/([^/]+)$/.exec(path)
  if (errMatch) {
    const key = errMatch[1]
    return ERROR_SEGMENT_LABELS[key] ?? '错误页'
  }

  if (path.startsWith('/clerk/')) {
    if (
      path === '/clerk/user-management' ||
      path.startsWith('/clerk/user-management/')
    ) {
      return '用户管理（Clerk）'
    }
    return 'Clerk'
  }

  if (path === '/') {
    return '数据概览'
  }

  for (const [prefix, title] of PREFIX_TITLES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return title
    }
  }

  return '管理后台'
}
