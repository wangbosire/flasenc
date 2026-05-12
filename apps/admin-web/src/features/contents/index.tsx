import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  applyContentAction,
  listPlatformContents,
  updateContentPermission,
  type PlatformContentListItem,
} from '@/api/platform-contents'
import { adminApiErrorMessage } from '@/lib/admin-api-error-message'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Main } from '@/components/layout/main'
import {
  CONTENT_LIST_PAGE_SIZE,
  draftToListQuery,
  EMPTY_CONTENT_FILTERS,
  type ContentListFilterDraft,
} from '@/features/contents/content-list.model'
import { ContentsFilterCard } from '@/features/contents/contents-filter-card'
import { ContentsListSection } from '@/features/contents/contents-list-section'
import { ContentsPermissionDialog } from '@/features/contents/contents-permission-dialog'

export function Contents() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterDraft, setFilterDraft] = useState<ContentListFilterDraft>(
    () => ({ ...EMPTY_CONTENT_FILTERS })
  )
  const [appliedFilters, setAppliedFilters] = useState<ContentListFilterDraft>(
    () => ({ ...EMPTY_CONTENT_FILTERS })
  )
  const [editingItem, setEditingItem] =
    useState<PlatformContentListItem | null>(null)
  const [publishStatus, setPublishStatus] = useState('')
  const [listingState, setListingState] = useState('')
  /** 默认收起折叠区：前 6 项在主网格中，lg 三列下等价于两行。 */
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const contentsQuery = useQuery({
    queryKey: [
      'admin',
      'contents',
      'list',
      page,
      CONTENT_LIST_PAGE_SIZE,
      appliedFilters,
    ],
    queryFn: () =>
      listPlatformContents(
        draftToListQuery(page, CONTENT_LIST_PAGE_SIZE, appliedFilters)
      ),
  })

  const permissionMutation = useMutation({
    mutationFn: (input: {
      contentId: string
      publishStatus: string
      listingState: string
    }) =>
      updateContentPermission(input.contentId, {
        publishStatus: input.publishStatus,
        listingState: input.listingState,
      }),
    onSuccess: () => {
      toast.success('内容权限已更新')
      setEditingItem(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contents'] })
    },
    onError: (err) => toast.error(adminApiErrorMessage(err)),
  })

  const submitModerationMutation = useMutation({
    mutationFn: (contentId: string) =>
      applyContentAction(contentId, 'submit-moderation'),
    onSuccess: () => {
      toast.success('已发起内容审核')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contents'] })
    },
    onError: (err) => toast.error(adminApiErrorMessage(err)),
  })

  const data = contentsQuery.data
  const rows = data?.items ?? []
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / CONTENT_LIST_PAGE_SIZE)
  )
  const actionBusy =
    permissionMutation.isPending || submitModerationMutation.isPending

  function openPermissionEditor(item: PlatformContentListItem) {
    setEditingItem(item)
    setPublishStatus(item.publishStatus)
    setListingState(item.listingState)
  }

  return (
    <Main className='space-y-4'>
      {contentsQuery.error ? (
        <Alert variant='destructive'>
          <AlertTitle>请求失败</AlertTitle>
          <AlertDescription>
            {adminApiErrorMessage(contentsQuery.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <ContentsFilterCard
        filterDraft={filterDraft}
        setFilterDraft={setFilterDraft}
        filtersExpanded={filtersExpanded}
        setFiltersExpanded={setFiltersExpanded}
        onSearch={() => {
          setPage(1)
          setAppliedFilters({ ...filterDraft })
        }}
        onReset={() => {
          setFilterDraft({ ...EMPTY_CONTENT_FILTERS })
          setAppliedFilters({ ...EMPTY_CONTENT_FILTERS })
          setPage(1)
        }}
        onRefresh={() => void contentsQuery.refetch()}
        isRefreshing={contentsQuery.isFetching}
      />

      <ContentsListSection
        rows={rows}
        isLoading={contentsQuery.isLoading}
        isFetching={contentsQuery.isFetching}
        actionBusy={actionBusy}
        page={page}
        totalPages={totalPages}
        total={data?.total ?? 0}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
        onEditPermission={openPermissionEditor}
        onSubmitModeration={(id) => submitModerationMutation.mutate(id)}
      />

      <ContentsPermissionDialog
        open={editingItem !== null}
        item={editingItem}
        publishStatus={publishStatus}
        listingState={listingState}
        onPublishStatusChange={setPublishStatus}
        onListingStateChange={setListingState}
        onDismiss={() => setEditingItem(null)}
        onSave={() => {
          if (!editingItem) return
          permissionMutation.mutate({
            contentId: editingItem.id,
            publishStatus,
            listingState,
          })
        }}
        isSaving={permissionMutation.isPending}
      />
    </Main>
  )
}
