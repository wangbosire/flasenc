import { format, parse } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/** `yyyy-MM-dd` 区间；`to` 省略表示仅选起点（查询按单日）。 */
export type DayRangeValue = { from: string; to?: string } | null

type DateRangePickerProps = {
  value: DayRangeValue
  onChange: (next: DayRangeValue) => void
  placeholder?: string
  className?: string
}

function toCalendarRange(value: DayRangeValue): DateRange | undefined {
  if (!value?.from) return undefined
  const from = parse(value.from, 'yyyy-MM-dd', new Date())
  const to = value.to ? parse(value.to, 'yyyy-MM-dd', new Date()) : undefined
  return { from, to }
}

function formatDay(d: Date) {
  return format(d, 'yyyy年M月d日', { locale: zhCN })
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = '选择日期区间',
  className,
}: DateRangePickerProps) {
  const selected = toCalendarRange(value)

  const label =
    value?.from && value?.to
      ? `${formatDay(parse(value.from, 'yyyy-MM-dd', new Date()))} — ${formatDay(parse(value.to, 'yyyy-MM-dd', new Date()))}`
      : value?.from
        ? `${formatDay(parse(value.from, 'yyyy-MM-dd', new Date()))} — …`
        : null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          data-empty={!label}
          className={cn(
            'h-9 w-full min-w-0 justify-start px-3 text-start font-normal data-[empty=true]:text-muted-foreground',
            className
          )}
        >
          {label ? (
            <span className='truncate'>{label}</span>
          ) : (
            <span>{placeholder}</span>
          )}
          <CalendarIcon className='ms-auto size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto max-w-[min(100vw-2rem,720px)] p-0'>
        <Calendar
          mode='range'
          captionLayout='dropdown'
          numberOfMonths={2}
          selected={selected}
          onSelect={(range) => {
            if (!range?.from) {
              onChange(null)
              return
            }
            onChange({
              from: format(range.from, 'yyyy-MM-dd'),
              to: range.to ? format(range.to, 'yyyy-MM-dd') : undefined,
            })
          }}
          disabled={(date: Date) =>
            date > new Date() || date < new Date('1900-01-01')
          }
        />
        <div className='flex justify-end gap-2 border-t border-border px-3 py-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            onClick={() => onChange(null)}
          >
            清除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
