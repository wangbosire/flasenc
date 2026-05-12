import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ANY = '__any__'

const triggerClass = 'h-9 w-full min-w-0'

/** 枚举筛选：含「不限」，选中后对外传空字符串。 */
export function OptionalEnumSelect({
  value,
  onValueChange,
  enumValues,
  labelOf,
}: {
  value: string
  onValueChange: (next: string) => void
  enumValues: readonly string[]
  labelOf: (v: string) => string
}) {
  return (
    <Select
      value={value || ANY}
      onValueChange={(v) => onValueChange(v === ANY ? '' : v)}
    >
      <SelectTrigger className={triggerClass}>
        <SelectValue placeholder='不限' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>不限</SelectItem>
        {enumValues.map((v) => (
          <SelectItem key={v} value={v}>
            {labelOf(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 是 / 否 / 不限（查询布尔或省略）。 */
export function TriStateSelect({
  value,
  onValueChange,
}: {
  value: '' | 'true' | 'false'
  onValueChange: (next: '' | 'true' | 'false') => void
}) {
  const selected = value === '' ? ANY : value
  return (
    <Select
      value={selected}
      onValueChange={(v) =>
        onValueChange(v === ANY ? '' : (v as 'true' | 'false'))
      }
    >
      <SelectTrigger className={triggerClass}>
        <SelectValue placeholder='不限' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>不限</SelectItem>
        <SelectItem value='true'>是</SelectItem>
        <SelectItem value='false'>否</SelectItem>
      </SelectContent>
    </Select>
  )
}
