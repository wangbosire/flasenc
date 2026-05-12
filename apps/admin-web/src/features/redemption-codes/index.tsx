import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import {
  createRedemptionCodeWithContent,
  type CreatedRedemptionCodeWithContent,
} from '@/api/content-entitlements'
import { AdminApiError } from '@/api/http'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyableTextButton } from '@/components/copyable-value'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Main } from '@/components/layout/main'

export function RedemptionCodes() {
  const [title, setTitle] = useState('')
  const [plainCode, setPlainCode] = useState('')
  const [created, setCreated] =
    useState<CreatedRedemptionCodeWithContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: { title?: string; plainCode?: string }) =>
      createRedemptionCodeWithContent(input),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      // plainCode 仅在本次响应返回，成功后保留结果卡片方便运营立即复制。
      setCreated(result)
      setPlainCode('')
      toast.success('内容、权益与兑换码已生成')
    },
    onError: (err) => setError(toMessage(err)),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      title: title.trim() || undefined,
      plainCode: plainCode.trim() || undefined,
    })
  }

  return (
    <Main className='space-y-6'>
      <div>
        <p className='text-muted-foreground'>
          提交后会在同一事务内创建占位内容、内容权益和兑换码。
        </p>
      </div>

        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className='grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
          <Card>
            <CardHeader>
              <CardTitle>兑换码信息</CardTitle>
              <CardDescription>
                明文码可选；不填时由服务端随机生成。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className='space-y-4' onSubmit={submit}>
                <div className='space-y-2'>
                  <Label htmlFor='content-title'>内容标题</Label>
                  <Input
                    id='content-title'
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder='例如：线下活动门票'
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
                <Button disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Ticket />
                  )}
                  生成兑换码
                </Button>
              </form>
            </CardContent>
          </Card>

          <ResultCard created={created} />
        </div>
      </Main>
  )
}

function ResultCard({
  created,
}: {
  created: CreatedRedemptionCodeWithContent | null
}) {
  const rows = created
    ? [
        ['contentId', created.contentId],
        ['entitlementId', created.entitlementId],
        ['redemptionCodeId', created.redemptionCodeId],
        ['plainCode', created.plainCode],
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>生成结果</CardTitle>
        <CardDescription>
          plainCode 只展示一次，请在离开页面前复制保存。
        </CardDescription>
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
                className='min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-left font-mono text-xs'
              />
            </div>
          ))
        ) : (
          <div className='rounded-lg border border-dashed p-6 text-sm text-muted-foreground'>
            生成成功后会显示内容、权益、兑换码记录和一次性明文码。
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
