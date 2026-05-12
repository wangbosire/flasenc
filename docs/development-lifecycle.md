# 研发流程（MVP 简版）

采用 **[Harness Engineering](https://openai.com/zh-Hans-CN/index/harness-engineering/)**：人类拍板范围与风险，智能体在门禁内改代码与文档；**结论须进版本库**（`docs/`、PR、Issue），口头约定视为无效。

## 1. 需求开发标准流程（详版）

1. **需求文档 + 技术设计**：背景、范围、验收可测；接口/数据/风险/回滚等设计要点。产出见 [与目录的对应](#3-与目录的对应)。
2. **评审**：对需求与设计评审并记录结论（Issue / PR / 文档修订说明）。
3. **根据评审优化文档**：同步修订需求与技术设计，再进入实现阶段。
4. **并行（互不阻塞）**：以下四项可同时进行、彼此不阻塞；以协作文档与任务拆分避免互相等待。
   1. 编写测试用例
   2. 制定开发计划（可与 `docs/exec-plans/` 对齐）
   3. 开发（符合 `ARCHITECTURE.md`、`FRONTEND.md`、`BACKEND.md`）
   4. 部署文档（环境、配置、发布与回滚要点）
5. **评审测试用例 → 优化测试用例**：评审通过后或按意见修订用例再继续。
6. **代码评审 → 根据意见修复**：PR 评审闭环。
7. **测试**：执行计划内测试（含 CI / 手工按范围验收）。
8. **修复缺陷**：缺陷与修复 PR / Issue 互链。
9. **回归测试**：不通过则回到步骤 8，直至通过。

**产出**：**测试报告**（范围、环境、结果、已知问题、是否达到发布门槛）；与发布验证可衔接 [`runbook/release-checklist.md`](./runbook/release-checklist.md)。

## 2. 主干（六步概览）

与详版对应关系如下（便于对外一句话说明）。

| 步 | 内容 | 产出位置 |
|----|------|----------|
| 1 需求 | 背景、范围、验收可测 | [`product-specs/`](./product-specs/index.md) 或 Issue |
| 2 方案 | 接口/数据/风险/回滚要点 | `product-specs/` 或 [`design-docs/`](./design-docs/index.md) |
| 3 开发 | 符合 `ARCHITECTURE.md`、[`FRONTEND.md`](./FRONTEND.md)、[`BACKEND.md`](./BACKEND.md) | 代码 + 配置模板 |
| 4 自测与 CI | 本地与 PR 门禁通过 | PR 描述 |
| 5 测试与修复 | 缺陷 ↔ PR 互链 | Issue |
| 6 发布与验证 | Smoke、观测、回滚预案 | [`runbook/release-checklist.md`](./runbook/release-checklist.md)、[`RELIABILITY.md`](./RELIABILITY.md)（链接可后补） |

## 3. 与目录的对应

| 内容 | 路径 |
|------|------|
| 需求与方案 | `docs/product-specs/`、`docs/design-docs/` |
| 任务与技术债 | `docs/exec-plans/` |
| 命令与环境 | `docs/references/` |
| 自动生成 | `docs/generated/` |

## 4. 维护

流程或门禁变更：同步更新本文、[`MVP.md`](./MVP.md) 与 [`AGENTS.md`](../AGENTS.md)。里程碑一句话记在 [`PLANS.md`](./PLANS.md)。
