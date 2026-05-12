import type { Dispatch, SetStateAction } from 'react'
import { ChevronDown, ChevronUp, Loader2, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/date-range-picker'
import { FilterField } from '@/components/filter-field'
import {
  OptionalEnumSelect,
  TriStateSelect,
} from '@/components/forms/admin-filter-selects'
import {
  CONTENT_FILTER_GRID_CLASS,
  CONTENT_STATUS_LABELS,
  LISTING_STATE_OPTIONS,
  PLACEHOLDER_KIND_OPTIONS,
  PUBLISH_STATUS_OPTIONS,
  REDEMPTION_CODE_STATUS_OPTIONS,
  type ContentListFilterDraft,
} from '@/features/contents/content-list.model'

export function ContentsFilterCard({
  filterDraft,
  setFilterDraft,
  filtersExpanded,
  setFiltersExpanded,
  onSearch,
  onReset,
  onRefresh,
  isRefreshing,
}: {
  filterDraft: ContentListFilterDraft
  setFilterDraft: Dispatch<SetStateAction<ContentListFilterDraft>>
  filtersExpanded: boolean
  setFiltersExpanded: Dispatch<SetStateAction<boolean>>
  onSearch: () => void
  onReset: () => void
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const publishZh = CONTENT_STATUS_LABELS.publishStatus as Record<
    string,
    string
  >
  const listingZh = CONTENT_STATUS_LABELS.listingState as Record<string, string>
  const placeholderZh = CONTENT_STATUS_LABELS.placeholderKind as Record<
    string,
    string
  >
  const redemptionZh = CONTENT_STATUS_LABELS.redemptionCodeStatus as Record<
    string,
    string
  >

  return (
    <Card className='gap-4 pb-3'>
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-3 space-y-0'>
        <CardTitle className='text-base font-medium'>筛选条件</CardTitle>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button size='sm' type='button' onClick={onSearch}>
            查询
          </Button>
          <Button size='sm' type='button' variant='outline' onClick={onReset}>
            重置
          </Button>
          <Button
            size='sm'
            type='button'
            variant='outline'
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className='animate-spin' />
            ) : (
              <RefreshCcw />
            )}
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-3 pt-0'>
        <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
          <div className={CONTENT_FILTER_GRID_CLASS}>
            <FilterField label='内容 ID'>
              <Input
                className='h-9 w-full min-w-0 font-mono text-xs'
                placeholder='UUID'
                value={filterDraft.contentId}
                onChange={(e) =>
                  setFilterDraft((s) => ({ ...s, contentId: e.target.value }))
                }
              />
            </FilterField>
            <FilterField label='标题包含'>
              <Input
                className='h-9 w-full min-w-0 text-sm'
                placeholder='子串模糊匹配'
                value={filterDraft.titleContains}
                onChange={(e) =>
                  setFilterDraft((s) => ({
                    ...s,
                    titleContains: e.target.value,
                  }))
                }
              />
            </FilterField>
            <FilterField label='发布态'>
              <OptionalEnumSelect
                value={filterDraft.publishStatus}
                onValueChange={(publishStatus) =>
                  setFilterDraft((s) => ({ ...s, publishStatus }))
                }
                enumValues={PUBLISH_STATUS_OPTIONS}
                labelOf={(v) => publishZh[v] ?? v}
              />
            </FilterField>
            <FilterField label='上架态'>
              <OptionalEnumSelect
                value={filterDraft.listingState}
                onValueChange={(listingState) =>
                  setFilterDraft((s) => ({ ...s, listingState }))
                }
                enumValues={LISTING_STATE_OPTIONS}
                labelOf={(v) => listingZh[v] ?? v}
              />
            </FilterField>
            <FilterField label='占位类型'>
              <OptionalEnumSelect
                value={filterDraft.placeholderKind}
                onValueChange={(placeholderKind) =>
                  setFilterDraft((s) => ({ ...s, placeholderKind }))
                }
                enumValues={PLACEHOLDER_KIND_OPTIONS}
                labelOf={(v) => placeholderZh[v] ?? v}
              />
            </FilterField>
            <FilterField label='持有者会员 ID'>
              <Input
                className='h-9 w-full min-w-0 font-mono text-xs'
                placeholder='UUID'
                value={filterDraft.ownerMemberId}
                onChange={(e) =>
                  setFilterDraft((s) => ({
                    ...s,
                    ownerMemberId: e.target.value,
                  }))
                }
              />
            </FilterField>
          </div>
          {!filtersExpanded ? (
            <CollapsibleTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='mt-3 h-auto w-full gap-1 py-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground'
              >
                <ChevronDown className='size-4 shrink-0' />
                展开更多筛选
              </Button>
            </CollapsibleTrigger>
          ) : null}
          <CollapsibleContent>
            <div className={cn(CONTENT_FILTER_GRID_CLASS, 'mt-3')}>
              {/* <FilterField label='权益 ID'>
                <Input
                  className='h-9 w-full min-w-0 font-mono text-xs'
                  placeholder='content_entitlements.id'
                  value={filterDraft.entitlementId}
                  onChange={(e) =>
                    setFilterDraft((s) => ({
                      ...s,
                      entitlementId: e.target.value,
                    }))
                  }
                />
              </FilterField> */}
              <FilterField label='是否有权益'>
                <TriStateSelect
                  value={filterDraft.hasEntitlement}
                  onValueChange={(hasEntitlement) =>
                    setFilterDraft((s) => ({ ...s, hasEntitlement }))
                  }
                />
              </FilterField>
              <FilterField label='是否有持有者'>
                <TriStateSelect
                  value={filterDraft.hasOwner}
                  onValueChange={(hasOwner) =>
                    setFilterDraft((s) => ({ ...s, hasOwner }))
                  }
                />
              </FilterField>
              <FilterField label='兑换码明文包含'>
                <Input
                  className='h-9 w-full min-w-0 text-sm'
                  placeholder='plain_code 子串'
                  value={filterDraft.redemptionPlainContains}
                  onChange={(e) =>
                    setFilterDraft((s) => ({
                      ...s,
                      redemptionPlainContains: e.target.value,
                    }))
                  }
                />
              </FilterField>
              <FilterField label='兑换码状态'>
                <OptionalEnumSelect
                  value={filterDraft.redemptionCodeStatus}
                  onValueChange={(redemptionCodeStatus) =>
                    setFilterDraft((s) => ({ ...s, redemptionCodeStatus }))
                  }
                  enumValues={REDEMPTION_CODE_STATUS_OPTIONS}
                  labelOf={(v) => redemptionZh[v] ?? v}
                />
              </FilterField>
              <FilterField label='创建时间'>
                <DateRangePicker
                  value={filterDraft.createdRange}
                  placeholder='选择创建时间区间'
                  onChange={(createdRange) =>
                    setFilterDraft((s) => ({ ...s, createdRange }))
                  }
                />
              </FilterField>
              <FilterField label='更新时间'>
                <DateRangePicker
                  value={filterDraft.updatedRange}
                  placeholder='选择更新时间区间'
                  onChange={(updatedRange) =>
                    setFilterDraft((s) => ({ ...s, updatedRange }))
                  }
                />
              </FilterField>
            </div>
            {/* 收起入口放在展开区底部，避免提示条夹在中间、向下滚动后不明显。 */}
            <CollapsibleTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='mt-3 h-auto w-full gap-1 py-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground'
              >
                <ChevronUp className='size-4 shrink-0' />
                收起筛选
              </Button>
            </CollapsibleTrigger>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
