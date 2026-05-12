import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Plus, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import {
  createContentEntitlement,
  createRedemptionCode,
  type CreatedEntitlement,
  type CreatedRedemptionCode,
} from '@/api/content-entitlements'
import { AdminApiError } from '@/api/http'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { CopyableTextButton } from '@/components/copyable-value'
import { Main } from '@/components/layout/main'

export function Apps() {
  const [title, setTitle] = useState('')
  const [entitlementId, setEntitlementId] = useState('')
  const [plainCode, setPlainCode] = useState('')
  const [createdEntitlement, setCreatedEntitlement] =
    useState<CreatedEntitlement | null>(null)
  const [createdCode, setCreatedCode] = useState<CreatedRedemptionCode | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const entitlementMutation = useMutation({
    mutationFn: (nextTitle: string) =>
      createContentEntitlement(nextTitle || undefined),
    onMutate: () => {
      setError(null)
      setCreatedCode(null)
    },
    onSuccess: (result) => {
      // 与后端 1:1:1 约定一致：占位内容、权益与唯一兑换码同事务创建。
      setCreatedEntitlement(result)
      setEntitlementId(result.entitlementId)
      setCreatedCode(null)
      toast.success('占位内容、权益与兑换码已创建')
    },
    onError: (err) => {
      setError(toMessage(err))
    },
  })

  const redemptionCodeMutation = useMutation({
    mutationFn: (input: { entitlementId: string; plainCode?: string }) =>
      createRedemptionCode(input.entitlementId, input.plainCode),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      // plainCode 只会在服务端响应中出现一次，因此创建后立即显式展示，方便运营复制。
      setCreatedCode(result)
      setPlainCode('')
      toast.success('兑换码已生成')
    },
    onError: (err) => setError(toMessage(err)),
  })

  const loading =
    entitlementMutation.isPending || redemptionCodeMutation.isPending

  function submitEntitlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    entitlementMutation.mutate(title.trim())
  }

  function submitRedemptionCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    redemptionCodeMutation.mutate({
      entitlementId: entitlementId.trim(),
      plainCode: plainCode.trim() || undefined,
    })
  }

  return (
    <Main className='space-y-6'>
      <div>
        <p className='text-muted-foreground'>
          创建权益接口会在同一事务内写入占位内容、权益与唯一兑换码；右侧表单仅用于历史上尚无码的权益补建。
        </p>
      </div>

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>创建权益</CardTitle>
            <CardDescription>
              同事务创建占位 Content、ContentEntitlement 与一条 RedemptionCode。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className='space-y-4' onSubmit={submitEntitlement}>
              <div className='space-y-2'>
                <Label htmlFor='entitlement-title'>占位标题</Label>
                <Input
                  id='entitlement-title'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder='例如：线下活动门票权益'
                />
              </div>
              <Button disabled={loading}>
                {loading ? <Loader2 className='animate-spin' /> : <Plus />}
                创建权益
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>补建兑换码（可选）</CardTitle>
            <CardDescription>
              仅当目标权益在库中尚无兑换码时使用；若已通过左侧创建则会得到 409。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className='space-y-4' onSubmit={submitRedemptionCode}>
              <div className='space-y-2'>
                <Label htmlFor='entitlement-id'>entitlementId</Label>
                <Input
                  id='entitlement-id'
                  required
                  value={entitlementId}
                  onChange={(event) => setEntitlementId(event.target.value)}
                  className='font-mono'
                  placeholder='00000000-0000-4000-8000-000000000000'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='plain-code'>自定义明文码（可选）</Label>
                <Input
                  id='plain-code'
                  value={plainCode}
                  onChange={(event) => setPlainCode(event.target.value)}
                  placeholder='不填则由服务端随机生成'
                />
              </div>
              <Button disabled={loading}>
                {loading ? <Loader2 className='animate-spin' /> : <Ticket />}
                生成兑换码
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <ResultCard
          title='最近创建的权益与兑换码'
          empty='提交左侧表单后会显示 entitlementId、contentId、redemptionCodeId 与一次性 plainCode。'
          rows={
            createdEntitlement
              ? [
                  ['entitlementId', createdEntitlement.entitlementId],
                  ['contentId', createdEntitlement.contentId],
                  ['redemptionCodeId', createdEntitlement.redemptionCodeId],
                  ['plainCode', createdEntitlement.plainCode],
                ]
              : []
          }
        />
        <ResultCard
          title='最近生成的兑换码'
          empty='生成后请立即复制 plainCode，服务端不会再次返回明文。'
          rows={
            createdCode
              ? [
                  ['redemptionCodeId', createdCode.redemptionCodeId],
                  ['plainCode', createdCode.plainCode],
                ]
              : []
          }
        />
      </div>
    </Main>
  )
}

function ResultCard({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: Array<[string, string]>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {rows.length ? (
          rows.map(([label, value]) => (
            <div key={label} className='flex min-w-0 items-center gap-2'>
              <div className='w-32 shrink-0 text-sm text-muted-foreground'>
                {label}
              </div>
              <CopyableTextButton
                value={value}
                copyLabel={`点击复制${label}`}
                className='min-w-0 flex-1 rounded bg-muted px-2 py-1 text-left font-mono text-xs break-all'
              />
            </div>
          ))
        ) : (
          <div className='rounded-lg border border-dashed p-6 text-sm text-muted-foreground'>
            {empty}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function toMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    return `${err.code}: ${err.message}`
  }
  return err instanceof Error ? err.message : String(err)
}
