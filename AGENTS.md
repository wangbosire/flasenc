# 智能体工作说明（地图）

本仓库采用 **[Harness Engineering](https://openai.com/zh-Hans-CN/index/harness-engineering/)** 思路：**人类掌舵、智能体执行**；**仓库内已版本化的文档与脚本为记录系统**；情境中读不到的约定视为不存在。

- **文档第一版（MVP）范围与索引**：[`docs/MVP.md`](docs/MVP.md)（必读/扩展分层；联调以该页所列真源为准）。
- **端到端研发链路（简版）**：[`docs/development-lifecycle.md`](docs/development-lifecycle.md)
- **渐进式披露**：本文件只做索引与硬约束；细节在 `docs/` 各子目录。

---

## 1. 应用与包（一行职责）

| 路径 | 包名 | 职责 |
|------|------|------|
| `apps/admin-web/` | `@flasenc/admin-web` | 管理后台（React + Rsbuild）。 |
| `apps/mobile/` | `@flasenc/mobile` | uni-app 多端客户端（Vue 3）。 |
| `apps/server/` | `@flasenc/server` | 后端 API（NestJS）；与前端仅经 HTTP/契约通信。 |
| `packages/ui/` | `@repo/ui` | 共享 React 组件。 |
| `packages/eslint-config/` | `@repo/eslint-config` | 共享 ESLint 配置。 |
| `packages/typescript-config/` | `@repo/typescript-config` | 共享 TS 配置。 |

更细的边界见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

---

## 2. 文档地图（按任务）

完整分层见 [`docs/MVP.md`](docs/MVP.md)。下表为高频入口。

| 需求 | 路径 |
|------|------|
| **MVP 文档索引（先读）** | [`docs/MVP.md`](docs/MVP.md) |
| 全流程（简版） | [`docs/development-lifecycle.md`](docs/development-lifecycle.md) |
| 架构边界与分层 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| **前端开发规范** | [`docs/FRONTEND.md`](docs/FRONTEND.md) |
| **后端（Nest）开发规范** | [`docs/BACKEND.md`](docs/BACKEND.md) |
| **HTTP API 与 `error.code`** | [`docs/api/http-api-specification.md`](docs/api/http-api-specification.md) |
| 安全 | [`docs/SECURITY.md`](docs/SECURITY.md) |
| 工程与设计原则（补充） | [`docs/DESIGN.md`](docs/DESIGN.md) |
| 可靠性 / 可观测 | [`docs/RELIABILITY.md`](docs/RELIABILITY.md) |
| **发布 Runbook** | [`docs/runbook/release-checklist.md`](docs/runbook/release-checklist.md) |
| 质量与测试 | [`docs/QUALITY_SCORE.md`](docs/QUALITY_SCORE.md) |
| 产品原则 | [`docs/PRODUCT_SENSE.md`](docs/PRODUCT_SENSE.md) |
| 里程碑 | [`docs/PLANS.md`](docs/PLANS.md) |
| 执行计划与技术债 | [`docs/exec-plans/`](docs/exec-plans/) |
| 命令速查 | [`docs/references/repo-commands-llms.txt`](docs/references/repo-commands-llms.txt) |
| 工具生成物（勿手改） | [`docs/generated/`](docs/generated/) |
| 设计文档索引 | [`docs/design-docs/index.md`](docs/design-docs/index.md) |
| 产品规格入口 | [`docs/product-specs/index.md`](docs/product-specs/index.md) |

---

## 3. 硬约束（摘要）

- **解析边界处的数据形状**；内部不传递未校验结构。
- **HTTP DTO 与接口文档**：`apps/server` 须遵守 [`docs/BACKEND.md`](docs/BACKEND.md) **第 4.1 节**（Zod 入参 `.describe`）、**第 10.1 节**（对外 DTO 类型与字段注释）、**第 10.2 节**（Controller `@param`）；契约变更时与实现同步修订。
- **依赖方向**：见 `ARCHITECTURE.md`；跨应用仅通过公开 API / `packages` 导出。
- **可观测**：结构化日志；关键路径具备日志/指标/追踪之一（见 `docs/RELIABILITY.md`）。
- **密钥**：不得写入仓库；仅环境变量名或密钥管理引用。
- **流程工件进仓**：评审结论、准入准出、发布检查等须落在 `docs/` 或与代码同库的约定路径（见 `docs/development-lifecycle.md`）。

---

## 4. 工作方式（Harness）

- **反馈回路**：自测、CI、提测、QA、线上监控的结论回写文档或 Issue/PR。
- **小步合并**：任务勾选与 `docs/exec-plans` 或 Issue 对齐（以仓库内链接为准）。
- **给地图不给百科全书**：大段说明拆到 `docs/development-lifecycle.md` 与专题页。

---

## 5. 工程门禁与模板（已落地）

- **CI**：[`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `pnpm install` → `lint` → `check-types` → `build` → `test`。
- **PR 模板**：[`.github/pull_request_template.md`](.github/pull_request_template.md) — 关联需求/方案、阶段、自测说明。
- **CODEOWNERS**：[`.github/CODEOWNERS`](.github/CODEOWNERS) — 请按路径填写 `@` 审阅人（当前为占位说明）。

## 6. 待补齐（维护者）

- [ ] 在 `.github/CODEOWNERS` 中取消注释并填写真实 `@` 用户或团队。  
- [ ] 将 `@flasenc/mobile` 的 `lint` / `check-types` 与根 turbo 对齐（可选，便于一条命令覆盖全仓）。  
- [ ] 在 `docs/RELIABILITY.md` 的 **SLO / 告警** 表中填入真实服务名与监控链接（模板与清单已就绪）。
