# MVP 文档地图

本页是仓库文档的**唯一入口与分层声明**。目标是少读、读对：日常开发先看最短路径，只有改到对应领域时再下钻专题文档。

本仓库仍按 **Harness Engineering** 工作：**人类掌舵范围与风险，智能体在门禁内执行**；结论、评审、发布检查、风险取舍必须进入版本化记录（文档、Issue 或 PR），口头约定不作为真源。

## 1. 最短路径

日常任务默认只读这些入口：

| 何时读 | 文档 |
|--------|------|
| 进入仓库、确认边界 | [`AGENTS.md`](../AGENTS.md) + [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| 写代码、跑命令 | [`references/repo-commands-llms.txt`](./references/repo-commands-llms.txt) |
| 需要协作流程 / 记录口径 | [`development-lifecycle.md`](./development-lifecycle.md) |
| 改接口或联调 | [`api/http-api-specification.md`](./api/http-api-specification.md) |
| 改具体端 | 前端读 [`FRONTEND.md`](./FRONTEND.md)，后端读 [`BACKEND.md`](./BACKEND.md) |

## 2. 按任务下钻

| 任务 | 只在需要时阅读 |
|------|----------------|
| 理解产品范围 / 验收 | [`product-specs/content-sharing-platform.md`](./product-specs/content-sharing-platform.md) |
| 理解技术方案 / 数据模型 | [`design-docs/index.md`](./design-docs/index.md) |
| 做安全、密钥、脱敏改动 | [`SECURITY.md`](./SECURITY.md) |
| 做发布、回滚、线上验证 | [`runbook/release-checklist.md`](./runbook/release-checklist.md)、[`RELIABILITY.md`](./RELIABILITY.md) |
| 拆任务、记录技术债 | [`exec-plans/`](./exec-plans/active/README.md)、[`exec-plans/tech-debt-tracker.md`](./exec-plans/tech-debt-tracker.md) |
| 需要更细流程模板 | [`development-lifecycle.md`](./development-lifecycle.md) |

## 3. 参考与模板

这些文档不阻塞日常开发；只有被任务点名或需要模板时再看。

| 类别 | 文档 |
|------|------|
| 工程原则补充 | [`DESIGN.md`](./DESIGN.md)、[`QUALITY_SCORE.md`](./QUALITY_SCORE.md)、[`PRODUCT_SENSE.md`](./PRODUCT_SENSE.md) |
| 新需求模板 / 评审包 | [`product-specs/index.md`](./product-specs/index.md) |
| 外部工具参考 | [`references/`](./references/README.md) |
| 自动生成，勿手改 | [`generated/`](./generated/) |

## 4. 防止文档继续膨胀

- 保持 Harness：重要决定必须可从仓库记录追溯到“谁拍板、为什么、如何验证”。
- 新信息优先补进已有真源；不要为一句规则新增顶层文档。
- 新文档必须在本页归类为“最短路径 / 按任务 / 参考与模板”之一。
- 契约变更以 HTTP 规范为准；实现细节以代码和对应专题文档为准；历史修订以 Git 为准，不维护长修订表。
