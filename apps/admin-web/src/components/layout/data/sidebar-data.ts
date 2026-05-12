import {
  Construction,
  LayoutDashboard,
  Monitor,
  Bug,
  FileText,
  FileX,
  HelpCircle,
  Lock,
  Bell,
  KeyRound,
  Palette,
  ServerOff,
  Settings,
  Wrench,
  UserCog,
  UserX,
  MessageSquareText,
  ShieldCheck,
  ClipboardList,
  GalleryVerticalEnd,
  History,
  Newspaper,
  ShieldAlert,
  Ticket,
  WandSparkles,
  Command,
} from 'lucide-react'
import { ClerkLogo } from '@/assets/clerk-logo'
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
          title: '模板列表',
          url: '/content-templates',
          icon: FileText,
        },
        {
          title: '权益管理',
          url: '/entitlements',
          icon: Newspaper,
        },
        {
          title: '评论管理',
          url: '/comments',
          icon: MessageSquareText,
        },
        {
          title: '转让记录',
          url: '/transfer-records',
          icon: KeyRound,
        },
      ],
    },
    {
      title: '审核管理',
      items: [
        {
          title: '模板与发布',
          icon: WandSparkles,
          items: [
            {
              title: '内容模板',
              url: '/apps',
              icon: FileText,
            },
            {
              title: '机审队列',
              url: '/tasks',
              icon: ShieldAlert,
            },
          ],
        },
        {
          title: '审计与追踪',
          icon: History,
          items: [
            {
              title: '审计日志',
              url: '/users',
              icon: ClipboardList,
            },
            {
              title: '转让记录',
              url: '/tasks',
              icon: KeyRound,
            },
          ],
        },
        {
          title: '认证页面',
          icon: ShieldCheck,
          items: [
            {
              title: '登录',
              url: '/sign-in',
            },
            {
              title: '忘记密码',
              url: '/forgot-password',
            },
          ],
        },
        {
          title: '错误页',
          icon: Bug,
          items: [
            {
              title: 'Unauthorized',
              url: '/errors/unauthorized',
              icon: Lock,
            },
            {
              title: 'Forbidden',
              url: '/errors/forbidden',
              icon: UserX,
            },
            {
              title: 'Not Found',
              url: '/errors/not-found',
              icon: FileX,
            },
            {
              title: 'Internal Server Error',
              url: '/errors/internal-server-error',
              icon: ServerOff,
            },
            {
              title: 'Maintenance Error',
              url: '/errors/maintenance-error',
              icon: Construction,
            },
          ],
        },
        {
          title: 'Clerk 示例',
          icon: ClerkLogo,
          items: [
            {
              title: 'Clerk Sign In',
              url: '/clerk/sign-in',
            },
            {
              title: 'Clerk User Management',
              url: '/clerk/user-management',
            },
          ],
        },
      ],
    },
    {
      title: '系统管理',
      items: [
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
