import {
  LayoutDashboard,
  Monitor,
  HelpCircle,
  Bell,
  FileText,
  Menu,
  Newspaper,
  Palette,
  Settings,
  ShieldAlert,
  Wrench,
  UserCog,
  ClipboardList,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Platform Admin',
    email: 'platform-admin@flasenc.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Flasenc',
      logo: Command,
      plan: 'Content Platform',
    },
  ],
  navGroups: [
    {
      title: '首页',
      items: [
        {
          title: '数据概览',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: '内容管理',
      items: [
        {
          title: '内容列表',
          url: '/contents',
          icon: FileText,
        },
        {
          title: '生成兑换码',
          url: '/redemption-codes',
          icon: Newspaper,
        },
      ],
    },
    {
      title: '审核管理',
      items: [
        {
          title: '机审队列',
          url: '/tasks',
          icon: ShieldAlert,
        },
        {
          title: '审计日志',
          url: '/users',
          icon: ClipboardList,
        },
      ],
    },
    {
      title: '系统管理',
      items: [
        {
          title: '菜单管理',
          url: '/system/menus',
          icon: Menu,
        },
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '账号',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: '通知',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: '显示',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: '帮助中心',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
