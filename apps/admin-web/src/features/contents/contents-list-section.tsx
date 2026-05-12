import { Pencil, ShieldCheck } from 'lucide-react'
import type { PlatformContentListItem } from '@/api/platform-contents'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CompactStatus,
  CopyableIdRow,
} from '@/features/contents/content-admin-display'

export function ContentsListSection({
  rows,
  isLoading,
  isFetching,
  actionBusy,
  page,
  totalPages,
  total,
  onPrevPage,
  onNextPage,
  onEditPermission,
  onSubmitModeration,
}: {
  rows: PlatformContentListItem[]
  isLoading: boolean
  isFetching: boolean
  actionBusy: boolean
  page: number
  totalPages: number
  total: number
  onPrevPage: () => void
  onNextPage: () => void
  onEditPermission: (item: PlatformContentListItem) => void
  onSubmitModeration: (contentId: string) => void
}) {
  return (
    <>
      <div className='relative overflow-x-auto rounded-lg border'>
        <Table className='min-w-[920px] table-fixed'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-[240px] text-xs font-medium text-muted-foreground'>
                内容
              </TableHead>
              <TableHead className='w-[118px] text-xs font-medium text-muted-foreground'>
                发布态
              </TableHead>
              <TableHead className='w-[118px] text-xs font-medium text-muted-foreground'>
                上架态
              </TableHead>
              <TableHead className='w-[112px] text-xs font-medium text-muted-foreground'>
                占位类型
              </TableHead>
              <TableHead className='w-[240px] text-xs font-medium text-muted-foreground'>
                兑换码
              </TableHead>
              <TableHead className='w-[132px] text-xs font-medium whitespace-nowrap text-muted-foreground'>
                更新时间
              </TableHead>
              <TableHead className='w-[168px] text-right text-xs font-medium text-muted-foreground'>
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((item) => (
                <TableRow key={item.id} className='align-top'>
                  <TableCell className='py-3'>
                    <div className='space-y-2'>
                      <div className='leading-snug font-medium'>
                        {item.title || '未命名内容'}
                      </div>
                      <CopyableIdRow value={item.id} />
                      {item.ownerMemberId ? (
                        <CopyableIdRow
                          caption='持有者'
                          value={item.ownerMemberId}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className='py-3'>
                    <CompactStatus
                      kind='publishStatus'
                      value={item.publishStatus}
                    />
                  </TableCell>
                  <TableCell className='py-3'>
                    <CompactStatus
                      kind='listingState'
                      value={item.listingState}
                    />
                  </TableCell>
                  <TableCell className='py-3'>
                    <CompactStatus
                      kind='placeholderKind'
                      value={item.placeholderKind}
                    />
                  </TableCell>
                  <TableCell className='py-3'>
                    {item.entitlementId ? (
                      (item.redemptionCodes ?? []).length > 0 ? (
                        <div className='space-y-2'>
                          {(item.redemptionCodes ?? []).map((code) => (
                            <div
                              key={code.id}
                              className='flex flex-col gap-0.5 space-y-1'
                            >
                              <div>
                                <CompactStatus
                                  kind='redemptionCodeStatus'
                                  value={code.status}
                                />
                              </div>
                              <CopyableIdRow
                                caption='兑换码'
                                value={code.plainCode || '--'}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className='text-xs text-muted-foreground'>
                          暂无记录
                        </span>
                      )
                    ) : (
                      <span className='text-xs text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='py-3 font-mono text-xs whitespace-nowrap text-muted-foreground'>
                    {formatUpdatedAt(item.updatedAt)}
                  </TableCell>
                  <TableCell className='py-3'>
                    <div className='flex flex-row flex-wrap justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8 px-2.5 text-xs'
                        onClick={() => onEditPermission(item)}
                      >
                        <Pencil className='size-3.5' />
                        权限
                      </Button>
                      <Button
                        size='sm'
                        className='h-8 px-2.5 text-xs'
                        disabled={actionBusy}
                        onClick={() => onSubmitModeration(item.id)}
                      >
                        <ShieldCheck className='size-3.5' />
                        审核
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='h-32 text-center text-muted-foreground'
                >
                  {isLoading ? '正在加载内容...' : '暂无内容'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <span className='text-sm text-muted-foreground'>
          共 {total} 条 · 第 {page} / {totalPages} 页
        </span>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            disabled={page <= 1 || isFetching}
            onClick={onPrevPage}
          >
            上一页
          </Button>
          <Button
            variant='outline'
            disabled={page >= totalPages || isFetching}
            onClick={onNextPage}
          >
            下一页
          </Button>
        </div>
      </div>
    </>
  )
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
