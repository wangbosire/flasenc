import { type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** 写入剪贴板并给出统一 toast（管理端 ID / 码字段共用）。 */
export async function copyValueToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  toast.success('已复制')
}

export type CopyableTextButtonProps = {
  /** 写入剪贴板的完整字符串 */
  value: string
  /** 读屏与原生 title，如「点击复制内容 ID」 */
  copyLabel: string
  /** 划入时气泡提示，默认「点击复制」 */
  hoverHint?: string
  className?: string
  children?: ReactNode
}

/**
 * 不显式复制图标：划入 `cursor-copy` + 虚线下划线；单击写入整块 `value`。
 */
export function CopyableTextButton({
  value,
  copyLabel,
  hoverHint = '点击复制',
  className,
  children,
}: CopyableTextButtonProps) {
  return (
    <Tooltip delayDuration={280}>
      <TooltipTrigger asChild>
        <button
          type='button'
          className={cn(
            'cursor-copy select-text rounded-sm bg-transparent p-0 font-inherit text-left text-foreground outline-none ring-offset-background',
            'transition-[color,text-decoration-color] duration-150 ease-out',
            'hover:underline hover:decoration-dashed hover:decoration-primary/50 hover:underline-offset-4',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className
          )}
          onClick={() => void copyValueToClipboard(value)}
          aria-label={copyLabel}
          title={copyLabel}
        >
          {children ?? value}
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom' sideOffset={6} className='font-normal'>
        {hoverHint}
      </TooltipContent>
    </Tooltip>
  )
}
