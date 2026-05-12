import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Flasenc 管理后台
          </CardTitle>
          <CardDescription>
            使用平台管理员账号登录。认证请求会发送到{' '}
            <code className='text-xs'>/admin/v1/auth/login</code>。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            管理端仅允许 <code className='text-xs'>platformAdmin</code> 用户访问。
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
