import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** 筛选网格中的标签 + 控件纵向组合（栅格列宽由外层 grid 控制）。 */
export function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='min-w-0 space-y-1.5'>
      <Label className='text-xs text-muted-foreground'>{label}</Label>
      {children}
    </div>
  )
}
