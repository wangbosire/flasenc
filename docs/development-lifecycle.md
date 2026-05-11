# 研发流程（MVP 简版）

采用 **[Harness Engineering](https://openai.com/zh-Hans-CN/index/harness-engineering/)**：人类拍板范围与风险，智能体在门禁内改代码与文档；**结论须进版本库**（`docs/`、PR、Issue），口头约定视为无效。

## 1. 主干（六步）

| 步 | 内容 | 产出位置 |
|----|------|----------|
| 1 需求 | 背景、范围、验收可测 | [`product-specs/`](./product-specs/index.md) 或 Issue |
| 2 方案 | 接口/数据/风险/回滚要点 | `product-specs/` 或 [`design-docs/`](./design-docs/index.md) |
| 3 开发 | 符合 `ARCHITECTURE.md`、[`FRONTEND.md`](./FRONTEND.md)、[`BACKEND.md`](./BACKEND.md) | 代码 + 配置模板 |
| 4 自测与 CI | 本地与 PR 门禁通过 | PR 描述 |
| 5 测试与修复 | 缺陷 ↔ PR 互链 | Issue |
| 6 发布与验证 | Smoke、观测、回滚预案 | [`runbook/release-checklist.md`](./runbook/release-checklist.md)、[`RELIABILITY.md`](./RELIABILITY.md)（链接可后补） |

## 2. 与目录的对应

| 内容 | 路径 |
|------|------|
| 需求与方案 | `docs/product-specs/`、`docs/design-docs/` |
| 任务与技术债 | `docs/exec-plans/` |
| 命令与环境 | `docs/references/` |
| 自动生成 | `docs/generated/` |

## 3. 维护

流程或门禁变更：同步更新本文、[`MVP.md`](./MVP.md) 与 [`AGENTS.md`](../AGENTS.md)。里程碑一句话记在 [`PLANS.md`](./PLANS.md)。
