import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createAdminMenuItem,
  deleteAdminMenuItem,
  listAdminMenuItems,
  reorderAdminMenuItems,
  updateAdminMenuItem,
  type AdminMenuItem,
  type AdminMenuItemInput,
} from '@/api/admin-menu'
import { AdminApiError } from '@/api/http'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { registeredAdminRoutes } from '@/lib/registered-admin-routes'
import { Main } from '@/components/layout/main'
import { adminMenuQueryKey } from '@/hooks/use-admin-menu'
import {
  adminMenuIcons,
  adminMenuIconOptions,
  resolveAdminMenuIcon,
  type AdminMenuIconKey,
} from '@/lib/admin-menu-icons'
const menuListQueryKey = ['admin', 'menu-items', 'list'] as const
const NO_PARENT = '__root__'
const NO_ROUTE = '__no_route__'
const NO_ICON = '__no_icon__'

type FormState = {
  id: string | null
  parentId: string
  title: string
  routePath: string
  iconKey: string
  sortOrder: string
  enabled: boolean
}

type TreeRow = {
  item: AdminMenuItem
  depth: number
  hasChildren: boolean
}

const emptyForm: FormState = {
  id: null,
  parentId: NO_PARENT,
  title: '',
  routePath: NO_ROUTE,
  iconKey: NO_ICON,
  sortOrder: '0',
  enabled: true,
}

export function MenuManagement() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const menuQuery = useQuery({
    queryKey: menuListQueryKey,
    queryFn: listAdminMenuItems,
  })

  const items = useMemo(
    () => sortForDisplay(menuQuery.data ?? []),
    [menuQuery.data]
  )
  const treeRows = useMemo(
    () => buildTreeRows(items, expandedIds),
    [expandedIds, items]
  )

  const parentOptions = useMemo(
    () =>
      items.filter(
        (item) =>
          item.id !== form.id && !item.routePath && depthOf(item, items) < 2
      ),
    [form.id, items]
  )
  const parentPathById = useMemo(() => buildPathById(items), [items])
  const SelectedIcon =
    form.iconKey === NO_ICON
      ? undefined
      : adminMenuIcons[form.iconKey as AdminMenuIconKey]

  const invalidateMenus = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: menuListQueryKey }),
      queryClient.invalidateQueries({ queryKey: adminMenuQueryKey }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: (input: AdminMenuItemInput & { id?: string }) => {
      const { id, ...payload } = input
      return id
        ? updateAdminMenuItem(id, payload)
        : createAdminMenuItem(payload)
    },
    onMutate: () => setError(null),
    onSuccess: async () => {
      toast.success(form.id ? '菜单项已更新' : '菜单项已创建')
      setForm(emptyForm)
      setDialogOpen(false)
      await invalidateMenus()
    },
    onError: (err) => setError(toMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminMenuItem,
    onMutate: () => setError(null),
    onSuccess: async () => {
      toast.success('菜单项已删除')
      setForm(emptyForm)
      setDialogOpen(false)
      await invalidateMenus()
    },
    onError: (err) => setError(toMessage(err)),
  })

  const reorderMutation = useMutation({
    mutationFn: reorderAdminMenuItems,
    onMutate: () => setError(null),
    onSuccess: async () => {
      toast.success('菜单排序已更新')
      await invalidateMenus()
    },
    onError: (err) => setError(toMessage(err)),
  })

  const busy =
    saveMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: AdminMenuItemInput & { id?: string } = {
      id: form.id ?? undefined,
      parentId: form.parentId === NO_PARENT ? null : form.parentId,
      title: form.title.trim(),
      routePath:
        form.routePath === NO_ROUTE || form.routePath.trim() === ''
          ? null
          : form.routePath.trim(),
      iconKey: form.iconKey === NO_ICON ? null : form.iconKey,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      enabled: form.enabled,
    }
    saveMutation.mutate(payload)
  }

  function openCreateDialog() {
    setError(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(item: AdminMenuItem) {
    setError(null)
    setForm({
      id: item.id,
      parentId: item.parentId ?? NO_PARENT,
      title: item.title,
      routePath: item.routePath ?? NO_ROUTE,
      iconKey: item.iconKey ?? NO_ICON,
      sortOrder: String(item.sortOrder),
      enabled: item.enabled,
    })
    setDialogOpen(true)
  }

  function toggle(item: AdminMenuItem) {
    updateAdminMenuItem(item.id, { enabled: !item.enabled })
      .then(async () => {
        toast.success(item.enabled ? '菜单项已禁用' : '菜单项已启用')
        await invalidateMenus()
      })
      .catch((err: unknown) => setError(toMessage(err)))
  }

  function move(item: AdminMenuItem, direction: -1 | 1) {
    const siblings = items
      .filter((candidate) => candidate.parentId === item.parentId)
      .sort(compareMenuItems)
    const index = siblings.findIndex((candidate) => candidate.id === item.id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return

    const next = [...siblings]
    const [picked] = next.splice(index, 1)
    next.splice(nextIndex, 0, picked)
    reorderMutation.mutate(
      next.map((candidate, order) => ({
        id: candidate.id,
        parentId: candidate.parentId,
        sortOrder: (order + 1) * 10,
      }))
    )
  }

  function toggleExpanded(itemId: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-muted-foreground'>
            配置后台侧栏与命令面板菜单；链接可填写站内路径或外部 URL。
          </p>
        </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => void menuQuery.refetch()}
              disabled={menuQuery.isFetching}
            >
              {menuQuery.isFetching ? (
                <Loader2 className='animate-spin' />
              ) : (
                <RefreshCcw />
              )}
              刷新
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus />
              新增菜单
            </Button>
          </div>
        </div>

        {error || menuQuery.error ? (
          <Alert variant='destructive'>
            <AlertTitle>请求失败</AlertTitle>
            <AlertDescription>
              {error ?? toMessage(menuQuery.error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>菜单项</CardTitle>
            <CardDescription>
              根节点作为侧栏分组；二级可配置链接或折叠项；三级必须绑定链接。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>链接</TableHead>
                  <TableHead>图标</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treeRows.length ? (
                  treeRows.map(({ depth, hasChildren, item }) => {
                    const Icon = resolveAdminMenuIcon(item.iconKey)
                    const expanded = expandedIds.has(item.id)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div
                            className='flex items-center gap-2'
                            style={{ paddingInlineStart: depth * 20 }}
                          >
                            {hasChildren ? (
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                className='size-6'
                                onClick={() => toggleExpanded(item.id)}
                                aria-label={expanded ? '收起' : '展开'}
                              >
                                {expanded ? <ChevronDown /> : <ChevronRight />}
                              </Button>
                            ) : (
                              <span className='size-6' />
                            )}
                            {Icon ? <Icon className='size-4' /> : null}
                            <span className='font-medium'>{item.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className='max-w-80 truncate font-mono text-xs'>
                          {item.routePath ?? (
                            <span className='text-muted-foreground'>
                              分组 / 折叠项
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{item.iconKey ?? '-'}</TableCell>
                        <TableCell>{item.sortOrder}</TableCell>
                        <TableCell>
                          <Badge variant={item.enabled ? 'default' : 'outline'}>
                            {item.enabled ? '启用' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-end gap-1'>
                            <ConfirmAction
                              title='确认上移菜单？'
                              description={`将「${item.title}」在同级菜单中上移。`}
                              confirmText='上移'
                              disabled={busy}
                              onConfirm={() => move(item, -1)}
                            >
                              <Button
                                variant='ghost'
                                size='icon'
                                disabled={busy}
                                aria-label='上移'
                              >
                                <ArrowUp />
                              </Button>
                            </ConfirmAction>
                            <ConfirmAction
                              title='确认下移菜单？'
                              description={`将「${item.title}」在同级菜单中下移。`}
                              confirmText='下移'
                              disabled={busy}
                              onConfirm={() => move(item, 1)}
                            >
                              <Button
                                variant='ghost'
                                size='icon'
                                disabled={busy}
                                aria-label='下移'
                              >
                                <ArrowDown />
                              </Button>
                            </ConfirmAction>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => openEditDialog(item)}
                              aria-label='编辑'
                            >
                              <Pencil />
                            </Button>
                            <ConfirmAction
                              title={item.enabled ? '确认禁用菜单？' : '确认启用菜单？'}
                              description={`将「${item.title}」${item.enabled ? '从侧栏和命令面板隐藏' : '恢复到侧栏和命令面板'}。`}
                              confirmText={item.enabled ? '禁用' : '启用'}
                              disabled={busy}
                              onConfirm={() => toggle(item)}
                            >
                              <Button
                                variant='ghost'
                                size='icon'
                                disabled={busy}
                                aria-label={item.enabled ? '禁用' : '启用'}
                              >
                                {item.enabled ? '停' : '启'}
                              </Button>
                            </ConfirmAction>
                            <ConfirmAction
                              title='确认删除菜单？'
                              description={`删除「${item.title}」后不可直接恢复；若存在子菜单，后端会拒绝删除。`}
                              confirmText='删除'
                              disabled={busy}
                              destructive
                              onConfirm={() => deleteMutation.mutate(item.id)}
                            >
                              <Button
                                variant='ghost'
                                size='icon'
                                disabled={busy}
                                aria-label='删除'
                              >
                                <Trash2 />
                              </Button>
                            </ConfirmAction>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='h-32 text-center text-muted-foreground'
                    >
                      {menuQuery.isLoading ? '正在加载菜单...' : '暂无菜单'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setForm(emptyForm)
          }}
        >
          <DialogContent className='sm:max-w-xl'>
            <DialogHeader>
              <DialogTitle>{form.id ? '编辑菜单项' : '新增菜单项'}</DialogTitle>
              <DialogDescription>
                链接留空可创建分组或折叠项；填写后会成为可点击菜单。
              </DialogDescription>
            </DialogHeader>
            <form className='space-y-4' onSubmit={submit}>
                <div className='space-y-2'>
                  <Label htmlFor='menu-title'>标题</Label>
                  <Input
                    id='menu-title'
                    value={form.title}
                    required
                    maxLength={64}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className='space-y-2'>
                  <Label>父级</Label>
                  <Select
                    value={form.parentId}
                    onValueChange={(parentId) =>
                      setForm((value) => ({ ...value, parentId }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>根分组</SelectItem>
                      {parentOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {parentPathById.get(item.id) ?? item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='menu-route-path'>链接</Label>
                  <Input
                    id='menu-route-path'
                    list='registered-admin-routes'
                    value={form.routePath === NO_ROUTE ? '' : form.routePath}
                    maxLength={512}
                    placeholder='/settings 或 https://example.com'
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        routePath: event.target.value,
                      }))
                    }
                  />
                  <datalist id='registered-admin-routes'>
                    {registeredAdminRoutes.map((route) => (
                      <option
                        key={route.path}
                        value={route.path}
                      >{`${route.group} / ${route.title}`}</option>
                    ))}
                  </datalist>
                </div>

                <div className='space-y-2'>
                  <Label>图标</Label>
                  <Select
                    value={form.iconKey}
                    onValueChange={(iconKey) =>
                      setForm((value) => ({ ...value, iconKey }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      {SelectedIcon ? (
                        <span className='flex items-center gap-2'>
                          <SelectedIcon className='size-4' />
                          <span>{form.iconKey}</span>
                        </span>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ICON}>无图标</SelectItem>
                      {adminMenuIconOptions.map(({ Icon, key, label }) => (
                        <SelectItem key={key} value={key}>
                          <span className='flex items-center gap-2'>
                            <Icon className='size-4' />
                            <span>{label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='menu-sort-order'>排序</Label>
                    <Input
                      id='menu-sort-order'
                      type='number'
                      value={form.sortOrder}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          sortOrder: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className='flex items-end gap-3 pb-2'>
                    <Switch
                      id='menu-enabled'
                      checked={form.enabled}
                      onCheckedChange={(enabled) =>
                        setForm((value) => ({ ...value, enabled }))
                      }
                    />
                    <Label htmlFor='menu-enabled'>启用</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button disabled={busy}>
                    {busy ? (
                      <Loader2 className='animate-spin' />
                    ) : form.id ? (
                      <Save />
                    ) : (
                      <Plus />
                    )}
                    {form.id ? '保存' : '创建'}
                  </Button>
                </DialogFooter>
              </form>
          </DialogContent>
        </Dialog>
      </Main>
  )
}

function sortForDisplay(items: AdminMenuItem[]): AdminMenuItem[] {
  const byParent = new Map<string | null, AdminMenuItem[]>()
  for (const item of items) {
    const siblings = byParent.get(item.parentId) ?? []
    siblings.push(item)
    byParent.set(item.parentId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort(compareMenuItems)
  }

  const result: AdminMenuItem[] = []
  const append = (parentId: string | null) => {
    for (const item of byParent.get(parentId) ?? []) {
      result.push(item)
      append(item.id)
    }
  }
  append(null)
  return result
}

function buildTreeRows(
  items: AdminMenuItem[],
  expandedIds: Set<string>
): TreeRow[] {
  const byParent = new Map<string | null, AdminMenuItem[]>()
  for (const item of items) {
    const siblings = byParent.get(item.parentId) ?? []
    siblings.push(item)
    byParent.set(item.parentId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort(compareMenuItems)
  }

  const rows: TreeRow[] = []
  const append = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) ?? []) {
      const hasChildren = (byParent.get(item.id)?.length ?? 0) > 0
      rows.push({ depth, hasChildren, item })
      if (hasChildren && expandedIds.has(item.id)) {
        append(item.id, depth + 1)
      }
    }
  }
  append(null, 0)
  return rows
}

function buildPathById(items: AdminMenuItem[]): Map<string, string> {
  const byId = new Map(items.map((item) => [item.id, item]))
  const pathById = new Map<string, string>()

  const resolvePath = (item: AdminMenuItem, seen = new Set<string>()): string => {
    if (pathById.has(item.id)) return pathById.get(item.id)!
    if (!item.parentId || seen.has(item.id)) {
      pathById.set(item.id, item.title)
      return item.title
    }

    seen.add(item.id)
    const parent = byId.get(item.parentId)
    const path = parent ? `${resolvePath(parent, seen)} / ${item.title}` : item.title
    pathById.set(item.id, path)
    return path
  }

  items.forEach((item) => resolvePath(item))
  return pathById
}

function compareMenuItems(a: AdminMenuItem, b: AdminMenuItem): number {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
}

function depthOf(item: AdminMenuItem, items: AdminMenuItem[]): number {
  let depth = 0
  let parentId = item.parentId
  const byId = new Map(items.map((candidate) => [candidate.id, candidate]))
  const seen = new Set<string>()
  while (parentId) {
    if (seen.has(parentId)) return depth
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) return depth
    depth += 1
    parentId = parent.parentId
  }
  return depth
}

function toMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    return `${err.code}: ${err.message}`
  }
  return err instanceof Error ? err.message : '未知错误'
}

function ConfirmAction({
  children,
  title,
  description,
  confirmText,
  disabled,
  destructive = false,
  onConfirm,
}: {
  children: React.ReactNode
  title: string
  description: string
  confirmText: string
  disabled?: boolean
  destructive?: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align='end' className='w-72'>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <div className='font-medium'>{title}</div>
            <p className='text-sm text-muted-foreground'>{description}</p>
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type='button'
              variant={destructive ? 'destructive' : 'default'}
              size='sm'
              disabled={disabled}
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
