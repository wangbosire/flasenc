# 架构说明（摘要）

> 与 **Harness** 一致：边界与分层应可从仓库读出；重大变更在技术方案与 `docs/design-docs/` 留痕。协作流程见 [`docs/development-lifecycle.md`](docs/development-lifecycle.md)。**文档总览（MVP 1.0）**见 [`docs/MVP.md`](docs/MVP.md)。

## Monorepo 布局

| 路径 | 包名 | 职责 |
|------|------|------|
| `apps/admin-web/` | `@flasenc/admin-web` | 管理后台：React 19 + Rsbuild + Tailwind；`dev` / `build` / `lint` / `test` 接入 turbo。 |
| `apps/mobile/` | `@flasenc/mobile` | 客户端：uni-app（Vue 3）多端（H5 / 各小程序等）；平台脚本为 `dev:*` / `build:*`，类型检查为 `type-check`。 |
| `apps/server/` | `@flasenc/server` | 后端：NestJS；`dev`（watch）、`build`、`lint`、`test` / `test:e2e` 接入 turbo；`check-types` 为 `tsc --noEmit`。 |
| `packages/ui/` | `@repo/ui` | 共享 React 组件库；供 Web 侧复用；`lint`、`check-types`。 |
| `packages/eslint-config/` | `@repo/eslint-config` | 共享 ESLint 配置（workspace 依赖）。 |
| `packages/typescript-config/` | `@repo/typescript-config` | 共享 TypeScript 配置基座。 |

**工作区**：`pnpm-workspace.yaml` 包含 `apps/*`、`packages/*`。

## 依赖与边界

- **跨应用**：不直接引用对方源码；共享逻辑放在 `packages/*` 并经 `exports` 暴露。
- **admin-web / mobile 与 server**：仅通过 **HTTP API**（或网关）与约定契约交互；**请求/响应形状、状态码、分页、`error.code`** 以 [`docs/api/http-api-specification.md`](docs/api/http-api-specification.md) 为准。类型与 DTO 如需共享，放入 `packages/*`（如 `api-contracts`）并在 `design-docs` 记录，禁止从 Web 端 deep-import 服务端模块。
- **admin-web 与 mobile**：技术栈不同，默认不共享运行时 UI；若未来共享类型或 API 契约，单独建 `packages/*` 并在 `design-docs` 记录。

## 分层（建议）

- **Web / 移动端（展示层）**：`Types → Config → Repo → Service → Runtime → UI`（可按项目裁剪）。  
- **Nest（`apps/server`）**：遵循模块与分层边界（Controller → Service → 基础设施）；领域规则不泄漏到无关模块。

## 机械 enforcement（待接入）

- 模块边界 lint、dependency-cruiser 等；接入后在此追加配置文件路径。
- CI：见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)（含 `lint`、`check-types`、`build`、`test`）。

## 实现规范

前后端编码细则见 [`docs/FRONTEND.md`](docs/FRONTEND.md) 与 [`docs/BACKEND.md`](docs/BACKEND.md)。
