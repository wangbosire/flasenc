# Flasenc Admin Web

管理后台基于 [`satnaing/shadcn-admin`](https://github.com/satnaing/shadcn-admin) 改造，保留其 Vite + TanStack Router + shadcn/ui 布局与组件体系，并接入 Flasenc 管理端 HTTP 契约。

## 技术栈

- React 19
- Vite
- TanStack Router / Query
- shadcn/ui（Tailwind CSS v4 + Radix UI）
- Zustand
- ESLint / Vitest / TypeScript

## Flasenc 适配

- 登录使用 `POST /admin/v1/auth/login`，实现位于 `src/features/auth/sign-in/components/user-auth-form.tsx`。
- HTTP 统一出口为 `src/api/http.ts`，遵守 `docs/api/http-api-specification.md` 的 `success` / `error.code` 信封。
- API origin 使用 `PUBLIC_ADMIN_API_ORIGIN`；为空时走 Vite 同源代理 `/admin -> http://localhost:3001`。
- 上游模板仍保留部分示例页面（如 tasks/users/apps/chats），后续按内容平台业务逐步替换。

## 命令

```bash
pnpm --filter @flasenc/admin-web dev
pnpm --filter @flasenc/admin-web build
pnpm --filter @flasenc/admin-web lint
pnpm --filter @flasenc/admin-web test
```

当前 Vite/Vitest/ESLint 版本要求 Node >= 20.19；本机若默认 Node 较低，可使用：

```bash
fnm exec --using v22.20.0 pnpm --filter @flasenc/admin-web build
```

## 上游组件说明

`satnaing/shadcn-admin` 对部分 shadcn/ui 组件做过 RTL 与行为调整。升级 `src/components/ui/` 时不要直接覆盖，先对照上游 README 与本项目业务改动手工合并。
