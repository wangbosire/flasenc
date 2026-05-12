import { adminSessionRequest } from './admin-session'

export type AdminMenuItem = {
  id: string
  parentId: string | null
  title: string
  routePath: string | null
  iconKey: string | null
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type AdminMenuTreeItem = AdminMenuItem & {
  children: AdminMenuTreeItem[]
}

export type AdminMenuItemInput = {
  parentId?: string | null
  title: string
  routePath?: string | null
  iconKey?: string | null
  sortOrder?: number
  enabled?: boolean
}

export type AdminMenuItemPatch = Partial<AdminMenuItemInput>

export type AdminMenuReorderItem = {
  id: string
  parentId: string | null
  sortOrder: number
}

export function listAdminMenuItems(): Promise<AdminMenuItem[]> {
  return adminSessionRequest<AdminMenuItem[]>('/admin/v1/menu-items', {
    method: 'GET',
  })
}

export function getAdminMenuTree(): Promise<AdminMenuTreeItem[]> {
  return adminSessionRequest<AdminMenuTreeItem[]>('/admin/v1/menu-items/tree', {
    method: 'GET',
  })
}

export function createAdminMenuItem(
  input: AdminMenuItemInput
): Promise<AdminMenuItem> {
  return adminSessionRequest<AdminMenuItem>('/admin/v1/menu-items', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAdminMenuItem(
  id: string,
  patch: AdminMenuItemPatch
): Promise<AdminMenuItem> {
  return adminSessionRequest<AdminMenuItem>(
    `/admin/v1/menu-items/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  )
}

export function reorderAdminMenuItems(
  items: AdminMenuReorderItem[]
): Promise<AdminMenuItem[]> {
  return adminSessionRequest<AdminMenuItem[]>('/admin/v1/menu-items/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  })
}

export function deleteAdminMenuItem(id: string): Promise<{ ok: true }> {
  return adminSessionRequest<{ ok: true }>(
    `/admin/v1/menu-items/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  )
}
