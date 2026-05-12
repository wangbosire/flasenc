import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCcw, Search } from 'lucide-react'
import { listAuditLogs } from '@/api/audit-logs'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const PAGE_SIZE = 20

export function Users() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    action: '',
    targetType: '',
    targetId: '',
  })
  const [page, setPage] = useState(1)

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', page, PAGE_SIZE, appliedFilters],
    queryFn: () =>
      // 审计列表是运营追溯入口，筛选条件为空时后端按创建时间倒序返回最新记录。
      listAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        action: appliedFilters.action || undefined,
        targetType: appliedFilters.targetType || undefined,
        targetId: appliedFilters.targetId || undefined,
      }),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters({
      action: action.trim(),
      targetType: targetType.trim(),
      targetId: targetId.trim(),
    })
    setPage(1)
  }

  const logs = logsQuery.data
  const totalPages = Math.max(1, Math.ceil((logs?.total ?? 0) / PAGE_SIZE))

  return (
    <>
      <Header fixed>
        <div className='me-auto'>
          <h1 className='text-lg font-semibold'>审计日志</h1>
        </div>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>审计与追踪</h2>
            <p className='text-muted-foreground'>
              查询平台操作、内容处置、权益创建和兑换码生成等审计记录。
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => void logsQuery.refetch()}
            disabled={logsQuery.isFetching}
          >
            {logsQuery.isFetching ? (
              <Loader2 className='animate-spin' />
            ) : (
              <RefreshCcw />
            )}
            刷新
          </Button>
        </div>

        {logsQuery.error ? (
          <Alert variant='destructive'>
            <AlertTitle>请求失败</AlertTitle>
            <AlertDescription>{toMessage(logsQuery.error)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
            <CardDescription>
              字段均为精确匹配，留空表示不过滤。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]'
              onSubmit={submit}
            >
              <div className='space-y-2'>
                <Label htmlFor='audit-action'>action</Label>
                <Input
                  id='audit-action'
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  placeholder='PLATFORM_CONTENT_UNLIST'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='audit-target-type'>targetType</Label>
                <Input
                  id='audit-target-type'
                  value={targetType}
                  onChange={(event) => setTargetType(event.target.value)}
                  placeholder='Content'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='audit-target-id'>targetId</Label>
                <Input
                  id='audit-target-id'
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className='font-mono'
                  placeholder='资源 id'
                />
              </div>
              <Button className='self-end' disabled={logsQuery.isFetching}>
                {logsQuery.isFetching ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Search />
                )}
                查询
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>日志列表</CardTitle>
            <CardDescription>
              共 {logs?.total ?? 0} 条，当前第 {logs?.page ?? page} 页。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>操作者</TableHead>
                  <TableHead>traceId</TableHead>
                  <TableHead>payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.items.length ? (
                  logs.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-mono text-xs'>
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant='secondary'>{item.action}</Badge>
                      </TableCell>
                      <TableCell className='max-w-56 whitespace-normal'>
                        <div>{item.targetType}</div>
                        <div className='break-all font-mono text-xs text-muted-foreground'>
                          {item.targetId}
                        </div>
                      </TableCell>
                      <TableCell className='max-w-44 truncate font-mono text-xs'>
                        {item.actorUserId ?? item.actorMemberId ?? '-'}
                      </TableCell>
                      <TableCell className='max-w-40 truncate font-mono text-xs'>
                        {item.traceId ?? '-'}
                      </TableCell>
                      <TableCell className='max-w-80 whitespace-normal'>
                        <code className='line-clamp-3 text-xs'>
                          {JSON.stringify(item.payload)}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='h-32 text-center text-muted-foreground'
                    >
                      {logsQuery.isLoading ? '正在加载审计日志...' : '暂无记录'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className='flex items-center justify-end gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </Button>
              <span className='text-sm text-muted-foreground'>
                {page} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                下一页
              </Button>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    return `${err.code}: ${err.message}`
  }
  return err instanceof Error ? err.message : String(err)
}
