# Flasenc

Flasenc 是内容分享平台 monorepo，采用 Harness Engineering：人类掌舵，智能体执行，仓库内文档、脚本和配置是长期记录系统。

## 应用

| 路径 | 职责 |
|------|------|
| `apps/admin-web` | 管理后台，React + Vite + TanStack Router + shadcn/ui。 |
| `apps/mobile` | uni-app 多端客户端。 |
| `apps/server` | NestJS 后端，包含 C 端 API 与管理端 API。 |
| `packages/*` | 共享 UI、ESLint、TypeScript 配置。 |

## Docker 开发

开发期间统一使用 Docker，避免 Node、pnpm、MySQL、Prisma Client 等本机差异。

```bash
pnpm docker:dev
```

该命令会启动：

| 容器 | 说明 | 端口 |
|------|------|------|
| `flasenc` | 项目开发容器；安装依赖、生成 Prisma Client、执行迁移和管理账号 seed，并启动前后端开发服务。 | `3000`、`3001`、`5173` |
| `flasenc-mysql` | MySQL 8.4，库名 `flasenc`。 | 宿主机 `3307` -> 容器 `3306` |

访问地址：

- 管理后台：http://localhost:5173
- C 端 API：http://localhost:3000/api/v1
- 管理端 API：http://localhost:3001/admin/v1

默认本地管理账号由 `db:seed:admin` 创建：

```text
admin@example.com
admin123..
```

常用命令：

```bash
pnpm docker:up      # 后台启动
pnpm docker:logs    # 查看 flasenc 容器日志
pnpm docker:shell   # 进入 flasenc 容器
pnpm docker:down    # 停止容器，保留 MySQL 数据卷
```

需要在统一环境里跑质量门禁时：

```bash
pnpm docker:shell
pnpm lint
pnpm check-types
pnpm build
pnpm test
```

如需重置 Docker MySQL 数据：

```bash
docker compose down -v
pnpm docker:dev
```

## 文档入口

- 最短路径：[`docs/MVP.md`](docs/MVP.md)
- 架构边界：[`ARCHITECTURE.md`](ARCHITECTURE.md)
- 开发流程：[`docs/development-lifecycle.md`](docs/development-lifecycle.md)
- 命令速查：[`docs/references/repo-commands-llms.txt`](docs/references/repo-commands-llms.txt)
