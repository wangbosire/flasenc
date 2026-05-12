export type RegisteredAdminRoute = {
  path: string
  title: string
  group: string
}

// 仅作为菜单表单的站内路径输入建议；自定义菜单仍允许填写任意链接。
export const registeredAdminRoutes = [
  { path: '/', title: '数据概览', group: '首页' },
  { path: '/contents', title: '内容列表', group: '内容管理' },
  { path: '/redemption-codes', title: '生成兑换码', group: '内容管理' },
  { path: '/tasks', title: '机审队列', group: '审核管理' },
  { path: '/users', title: '审计日志', group: '审核管理' },
  { path: '/chats', title: '会话示例', group: '示例' },
  { path: '/system/menus', title: '菜单管理', group: '系统管理' },
  { path: '/settings', title: '资料设置', group: '系统管理' },
  { path: '/settings/account', title: '账号设置', group: '系统管理' },
  { path: '/settings/appearance', title: '外观设置', group: '系统管理' },
  { path: '/settings/notifications', title: '通知设置', group: '系统管理' },
  { path: '/settings/display', title: '显示设置', group: '系统管理' },
  { path: '/help-center', title: '帮助中心', group: '系统管理' },
] as const satisfies RegisteredAdminRoute[]
