import { cn } from '@/lib/utils'
import { CopyableTextButton } from '@/components/copyable-value'
import {
  CONTENT_STATUS_LABELS,
  type ContentStatusKind,
} from '@/features/contents/content-list.model'

/** 列表内 ID / 码：完整展示；悬停复制光标，点击整块写入剪贴板。可选左侧说明。 */
export function CopyableIdRow({
  caption,
  value,
}: {
  caption?: string
  value: string
}) {
  const copyLabel =
    caption === undefined
      ? '点击复制内容 ID'
      : caption === '兑换码'
        ? '点击复制兑换码明文'
        : caption === '记录'
          ? '点击复制兑换码记录 ID'
          : `点击复制${caption} ID`
  return (
    <div
      className={cn(
        'flex items-center gap-1',
        /**
         * 有 caption：占满单元格宽度便于长 UUID 折行；值区域 `flex-1`。
         * 无 caption（内容 id）：`inline-flex` 宽度随文案，避免列内大块留白。
         */
        caption !== undefined ? 'w-full min-w-0' : 'inline-flex max-w-full'
      )}
    >
      {caption !== undefined ? (
        <span className='w-12 shrink-0 text-[11px] text-muted-foreground'>
          {caption}
        </span>
      ) : null}
      <CopyableTextButton
        value={value}
        copyLabel={copyLabel}
        className={cn(
          'min-w-0 font-mono text-[11px] break-all',
          caption !== undefined && 'flex-1'
        )}
      />
    </div>
  )
}

export function CompactStatus({
  kind,
  value,
}: {
  kind: ContentStatusKind
  value: string
}) {
  const zh = statusLabel(kind, value)
  return (
    <div
      className={cn(
        'inline-flex rounded-md border px-2 py-1 text-xs leading-tight font-medium',
        statusTone(kind, value)
      )}
    >
      {zh}
    </div>
  )
}

/** 表单下拉等处仅用中文展示状态值（取值仍为后端枚举）。 */
export function StatusText({
  kind,
  value,
}: {
  kind: ContentStatusKind
  value: string
}) {
  return (
    <span className='text-sm leading-tight'>{statusLabel(kind, value)}</span>
  )
}

function statusTone(kind: ContentStatusKind, value: string): string {
  if (kind === 'publishStatus') {
    const tones: Partial<Record<string, string>> = {
      DRAFT: 'border-transparent bg-muted/80 text-foreground dark:bg-muted/40',
      SUBMITTED:
        'border-blue-500/25 bg-blue-500/10 text-blue-900 dark:text-blue-100',
      PUBLISHED:
        'border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
      MACHINE_REJECTED:
        'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300',
      SUSPICIOUS_PUBLISHED:
        'border-amber-500/40 bg-amber-500/12 text-amber-950 dark:text-amber-100',
      MANUALLY_REJECTED:
        'border-orange-500/30 bg-orange-500/10 text-orange-950 dark:text-orange-100',
    }
    return tones[value] ?? 'border-border bg-background'
  }
  if (kind === 'listingState') {
    if (value === 'NORMAL') {
      return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-950 dark:text-emerald-100'
    }
    if (value === 'PLATFORM_UNLISTED') {
      return 'border-muted-foreground/25 bg-muted text-muted-foreground'
    }
    if (value === 'EMERGENCY_HIDDEN') {
      return 'border-destructive/25 bg-destructive/10 text-destructive dark:text-red-300'
    }
    return 'border-border bg-background'
  }
  if (kind === 'placeholderKind') {
    return value === 'OWNED'
      ? 'border-violet-500/25 bg-violet-500/8 text-violet-950 dark:text-violet-100'
      : 'border-border bg-muted/60 text-foreground'
  }
  if (kind === 'redemptionCodeStatus') {
    if (value === 'ACTIVE') {
      return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-950 dark:text-emerald-100'
    }
    if (value === 'REDEEMED') {
      return 'border-muted-foreground/25 bg-muted text-muted-foreground'
    }
    if (value === 'INVALIDATED') {
      return 'border-destructive/25 bg-destructive/10 text-destructive dark:text-red-300'
    }
  }
  return 'border-border bg-background'
}

function statusLabel(kind: ContentStatusKind, value: string): string {
  const labels = CONTENT_STATUS_LABELS[kind] as Record<string, string>
  return labels[value] ?? value
}
