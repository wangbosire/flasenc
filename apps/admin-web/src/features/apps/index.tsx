import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, Loader2, Plus, Ticket } from 'lucide-react'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

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
      // 权益创建会同时生成占位内容，前端保存两个 id 以便继续生成兑换码或跳转复核。
      setCreatedEntitlement(result)
      setEntitlementId(result.entitlementId)
      toast.success('权益与占位内容已创建')
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
    <>
      <Header>
        <div className='me-auto'>
          <h1 className='text-lg font-semibold'>权益与兑换码</h1>
        </div>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>权益发放</h2>
          <p className='text-muted-foreground'>
            创建内容权益、占位内容，并为权益生成一次性兑换码。
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
                后端会在同一事务内创建 ContentEntitlement 与占位 Content。
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
              <CardTitle>生成兑换码</CardTitle>
              <CardDescription>
                可使用刚创建的 entitlementId，也可粘贴已有权益 id。
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
            title='最近创建的权益'
            empty='创建权益后会显示 entitlementId 与 contentId。'
            rows={
              createdEntitlement
                ? [
                    ['entitlementId', createdEntitlement.entitlementId],
                    ['contentId', createdEntitlement.contentId],
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
    </>
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
              <code className='min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs'>
                {value}
              </code>
              <Button
                variant='outline'
                size='icon'
                onClick={() => void copy(value)}
                aria-label={`复制 ${label}`}
              >
                <Copy />
              </Button>
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

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('已复制')
}

function toMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    return `${err.code}: ${err.message}`
  }
  return err instanceof Error ? err.message : String(err)
}
