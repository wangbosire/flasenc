import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCcw, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { toast } from 'sonner'
import {
  applyContentAction,
  getContentAdminDetail,
  getContentTransferRecords,
  listSuspiciousPublishedQueue,
  type ContentTransferRecordsPage,
} from '@/api/platform-contents'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Main } from '@/components/layout/main'

const PAGE_SIZE = 10
const TRANSFER_PAGE_SIZE = 10

type ActionName =
  | 'unlist'
  | 'hide'
  | 'restore-listing'
  | 'clear-suspicion'
  | 'mark-manually-rejected'

const adminContentKeys = {
  suspiciousQueue: (page: number) =>
    ['admin', 'contents', 'suspicious-queue', page, PAGE_SIZE] as const,
  detail: (contentId: string) => ['admin', 'contents', contentId] as const,
  transfers: (contentId: string) =>
    [
      'admin',
      'contents',
      contentId,
      'transfer-records',
      1,
      TRANSFER_PAGE_SIZE,
    ] as const,
}

export function Tasks() {
  const queryClient = useQueryClient()
  const [contentIdInput, setContentIdInput] = useState('')
  const [selectedContentId, setSelectedContentId] = useState('')
  const [page, setPage] = useState(1)

  const queueQuery = useQuery({
    queryKey: adminContentKeys.suspiciousQueue(page),
    queryFn: () =>
      listSuspiciousPublishedQueue({ page, pageSize: PAGE_SIZE }),
  })

  const detailQuery = useQuery({
    queryKey: adminContentKeys.detail(selectedContentId),
    queryFn: () => getContentAdminDetail(selectedContentId),
    enabled: selectedContentId.length > 0,
  })

  const transfersQuery = useQuery({
    queryKey: adminContentKeys.transfers(selectedContentId),
    queryFn: () =>
      getContentTransferRecords(selectedContentId, {
        page: 1,
        pageSize: TRANSFER_PAGE_SIZE,
      }),
    enabled: selectedContentId.length > 0,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ActionName }) =>
      applyContentAction(id, action),
    onSuccess: (_data, variables) => {
      toast.success('内容状态已更新')
      // 写操作之后让 React Query 统一失效服务端状态，避免页面局部状态和后端事实分叉。
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contents'] })
      setSelectedContentId(variables.id)
      setContentIdInput(variables.id)
    },
    onError: (err) => toast.error(toMessage(err)),
  })

  const submitLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextId = contentIdInput.trim()
    if (nextId) {
      setSelectedContentId(nextId)
    }
  }

  const inspectContent = (id: string) => {
    setContentIdInput(id)
    setSelectedContentId(id)
  }

  const queue = queueQuery.data
  const detail = detailQuery.data
  const totalPages = Math.max(1, Math.ceil((queue?.total ?? 0) / PAGE_SIZE))
  const pageError = queueQuery.error ?? detailQuery.error ?? transfersQuery.error
  const isDetailBusy =
    detailQuery.isFetching ||
    transfersQuery.isFetching ||
    actionMutation.isPending

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-muted-foreground'>
            处理疑似已发布内容、平台下架/隐藏，并查询内容转让记录。
          </p>
        </div>
          <Button
            variant='outline'
            onClick={() => void queueQuery.refetch()}
            disabled={queueQuery.isFetching}
          >
            {queueQuery.isFetching ? (
              <Loader2 className='animate-spin' />
            ) : (
              <RefreshCcw />
            )}
            刷新
          </Button>
        </div>

        {pageError ? (
          <Alert variant='destructive'>
            <AlertTitle>请求失败</AlertTitle>
            <AlertDescription>{toMessage(pageError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]'>
          <Card>
            <CardHeader>
              <CardTitle>机审疑似队列</CardTitle>
              <CardDescription>
                共 {queue?.total ?? 0} 条，当前第 {queue?.page ?? page} 页。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>发布态</TableHead>
                    <TableHead>上架态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className='text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue?.items.length ? (
                    queue.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className='min-w-72 whitespace-normal'>
                          <div className='font-medium'>
                            {item.title || '未命名内容'}
                          </div>
                          <div className='mt-1 break-all font-mono text-xs text-muted-foreground'>
                            {item.id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant='secondary'>{item.publishStatus}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{item.listingState}</Badge>
                        </TableCell>
                        <TableCell className='font-mono text-xs'>
                          {formatDate(item.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-end gap-2'>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => inspectContent(item.id)}
                            >
                              查看
                            </Button>
                            <Button
                              size='sm'
                              disabled={actionMutation.isPending}
                              onClick={() =>
                                actionMutation.mutate({
                                  id: item.id,
                                  action: 'clear-suspicion',
                                })
                              }
                            >
                              <ShieldCheck />
                              通过
                            </Button>
                            <Button
                              size='sm'
                              variant='destructive'
                              disabled={actionMutation.isPending}
                              onClick={() =>
                                actionMutation.mutate({
                                  id: item.id,
                                  action: 'mark-manually-rejected',
                                })
                              }
                            >
                              <ShieldX />
                              驳回
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='h-32 text-center text-muted-foreground'
                      >
                        {queueQuery.isLoading
                          ? '正在加载队列...'
                          : '暂无疑似内容'}
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

          <Card>
            <CardHeader>
              <CardTitle>内容详情与处置</CardTitle>
              <CardDescription>
                支持直接输入 contentId 查询任意平台可见详情。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <form className='flex gap-2' onSubmit={submitLookup}>
                <Input
                  value={contentIdInput}
                  onChange={(event) => setContentIdInput(event.target.value)}
                  placeholder='content UUID'
                  className='font-mono'
                />
                <Button disabled={isDetailBusy}>
                  {isDetailBusy ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Search />
                  )}
                  查询
                </Button>
              </form>

              {detail ? (
                <div className='space-y-4'>
                  <div className='grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2'>
                    <Field label='标题' value={detail.title || '未命名内容'} />
                    <Field label='占位类型' value={detail.placeholderKind} />
                    <Field label='发布态' value={detail.publishStatus} />
                    <Field label='上架态' value={detail.listingState} />
                    <Field label='Owner' value={detail.ownerMemberId ?? '-'} />
                    <Field label='权益' value={detail.entitlementId ?? '-'} />
                  </div>

                  <div className='flex flex-wrap gap-2'>
                    <Button
                      variant='outline'
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          id: detail.id,
                          action: 'unlist',
                        })
                      }
                    >
                      平台下架
                    </Button>
                    <Button
                      variant='outline'
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({ id: detail.id, action: 'hide' })
                      }
                    >
                      紧急隐藏
                    </Button>
                    <Button
                      variant='outline'
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          id: detail.id,
                          action: 'restore-listing',
                        })
                      }
                    >
                      恢复上架
                    </Button>
                  </div>

                  <details className='rounded-lg border'>
                    <summary className='cursor-pointer px-4 py-3 text-sm font-medium'>
                      内容 body
                    </summary>
                    <pre className='max-h-72 overflow-auto border-t p-4 text-xs'>
                      {JSON.stringify(detail.body, null, 2)}
                    </pre>
                  </details>

                  <TransferTable transfers={transfersQuery.data ?? null} />
                </div>
              ) : (
                <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                  选择队列行或输入 contentId 后查看详情。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='truncate font-mono'>{value}</div>
    </div>
  )
}

function TransferTable({
  transfers,
}: {
  transfers: ContentTransferRecordsPage | null
}) {
  return (
    <div className='rounded-lg border'>
      <div className='border-b px-4 py-3 text-sm font-medium'>
        转让记录（{transfers?.total ?? 0}）
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>方式</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>转出方</TableHead>
            <TableHead>受让方</TableHead>
            <TableHead>创建时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers?.items.length ? (
            transfers.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.method}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell className='max-w-32 truncate font-mono text-xs'>
                  {item.fromMemberId}
                </TableCell>
                <TableCell className='max-w-32 truncate font-mono text-xs'>
                  {item.toMemberId ?? '-'}
                </TableCell>
                <TableCell className='font-mono text-xs'>
                  {formatDate(item.createdAt)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className='h-20 text-center text-muted-foreground'
              >
                暂无转让记录
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
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
