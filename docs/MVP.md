# 文档第一版（MVP）

本页为仓库**文档体系的唯一版本声明**：**MVP 1.0**。以下路径为协作真源；未列出的专题文档视为**扩展材料**，不阻塞发版与联调。

## 1. 必读（MVP）

| 用途 | 路径 |
|------|------|
| 应用与包、硬约束、CI | 根目录 [`AGENTS.md`](../AGENTS.md) |
| Monorepo 边界与分层 | 根目录 [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| 需求→上线的最小流程 | [`development-lifecycle.md`](./development-lifecycle.md) |
| HTTP 信封、版本前缀、`error.code`、接口清单 | [`api/http-api-specification.md`](./api/http-api-specification.md) |
| 前端规范 | [`FRONTEND.md`](./FRONTEND.md) |
| 后端规范 | [`BACKEND.md`](./BACKEND.md) |
| 安全摘要 | [`SECURITY.md`](./SECURITY.md) |
| 发版自检 | [`runbook/release-checklist.md`](./runbook/release-checklist.md) |
| 命令速查（人/智能体） | [`references/repo-commands-llms.txt`](./references/repo-commands-llms.txt) |

## 2. 扩展（按需阅读）

| 用途 | 路径 |
|------|------|
| 工程与设计原则（补充） | [`DESIGN.md`](./DESIGN.md) |
| 可观测 / SLO 模板 | [`RELIABILITY.md`](./RELIABILITY.md) |
| 质量与测试 | [`QUALITY_SCORE.md`](./QUALITY_SCORE.md) |
| 产品原则（占位级） | [`PRODUCT_SENSE.md`](./PRODUCT_SENSE.md) |
| 内容分享平台：需求（合订）/ 技术方案 / Prisma | [`product-specs/content-sharing-platform.md`](./product-specs/content-sharing-platform.md)、[`design-docs/`](./design-docs/index.md) |
| 执行计划与技术债 | [`exec-plans/`](./exec-plans/active/README.md)、[`exec-plans/tech-debt-tracker.md`](./exec-plans/tech-debt-tracker.md) |
| 工具生成物（勿手改） | [`generated/`](./generated/) |

## 3. 版本策略（MVP 之后）

- **接口与契约**：以 [`api/http-api-specification.md`](./api/http-api-specification.md) 为准；破坏性变更须走评审，并在 PR 中写明迁移与客户端影响。
- **不再维护**「逐条修订履历」长表；历史以 Git 为准。若需对外发布说明，在 PR 或 `PLANS.md` 中记一条即可。

## 4. 与入口的关系

- 根目录 [`README.md`](../README.md)（若存在）或本仓库约定：**智能体与人类**优先读 **`AGENTS.md`** + **`docs/MVP.md`**，再按需下钻。
