# 质量与测试

与全流程中 **自测、提测、QA、问题修复** 对齐（[`development-lifecycle.md`](development-lifecycle.md)）。前后端实现与测试底线见 [`FRONTEND.md`](FRONTEND.md)、[`BACKEND.md`](BACKEND.md)。

## CI 门禁（已接入）

工作流：[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)（`push` / `pull_request` 至 `main` 或 `master`）。

| 步骤 | 命令 | 说明 |
|------|------|------|
| 安装 | `pnpm install --frozen-lockfile` | 与锁文件一致 |
| 静态检查 | `pnpm lint` | `turbo run lint`，覆盖已配置 `lint` 的 workspace |
| 类型检查 | `pnpm check-types` | `turbo run check-types` |
| 构建 | `pnpm build` | `turbo run build` |
| 单元测试 | `pnpm test` | `turbo run test`，仅对声明了 `test` 脚本的包执行（如 `@flasenc/admin-web`、`@flasenc/server`） |

合并前须保证 **与默认分支的 PR 上 CI 全绿**（或按团队政策对已知失败有豁免记录）。

## 与 `@flasenc/mobile`

`mobile` 使用脚本名 **`type-check`**（`vue-tsc`），**不在**根 `pnpm check-types` 的 turbo 任务中。变更 mobile 时合并前须至少执行：

`pnpm --filter @flasenc/mobile run type-check`

（可选后续：为 mobile 增加 `check-types` 别名并接入 turbo，使根命令一次覆盖。）

## 测试金字塔

- 单测为主；集成 / E2E 覆盖关键旅程与回归（server 见 `BACKEND.md` 中 `test` / `test:e2e`）。  
- **提测**须带：环境、范围、已知问题、关联需求路径（见 PR 模板）。

## 发布质量

发版前后检查见 [`runbook/release-checklist.md`](runbook/release-checklist.md)。
