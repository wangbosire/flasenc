# @flasenc/server

NestJS 后端包，包含两个 HTTP 应用：

- `front`：C 端 API，前缀 `/api/v1`，默认端口 `3000`
- `admin`：管理端 API，前缀 `/admin/v1`，默认端口 `3001`

## Docker 开发

本仓库开发期间统一使用根目录 `compose.yml`。

```bash
pnpm docker:dev
```

启动后：

- 应用容器：`flasenc`
- MySQL 容器：`flasenc-mysql`
- 容器内数据库：`mysql://root:root123..@flasenc-mysql:3306/flasenc`
- 宿主机直连数据库：`mysql://root:root123..@127.0.0.1:3307/flasenc`

`pnpm docker:dev` 会自动执行 Prisma Client 生成、迁移部署和本地管理账号 seed。

默认管理账号：

```text
admin@example.com
admin123..
```

## 常用命令

在统一环境内执行：

```bash
pnpm docker:shell
pnpm --filter @flasenc/server run db:test-connection
pnpm --filter @flasenc/server run test
pnpm --filter @flasenc/server run test:e2e
```

日常改表请进入容器后在 `apps/server` 执行：

```bash
pnpm run db:migrate:dev
```

对齐已有迁移文件：

```bash
pnpm run db:migrate:deploy
```

更多约束见 [`../../docs/BACKEND.md`](../../docs/BACKEND.md) 与 [`../../docs/api/http-api-specification.md`](../../docs/api/http-api-specification.md)。
