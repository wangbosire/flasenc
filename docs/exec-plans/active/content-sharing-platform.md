# 执行计划：内容分享平台（权益兑换）

## 关联需求 / 方案路径

| 类型 | 路径 |
|------|------|
| 需求真源 | [`../../product-specs/content-sharing-platform.md`](../../product-specs/content-sharing-platform.md) |
| 产品评审包 | [`../../product-specs/content-sharing-platform-product-review.md`](../../product-specs/content-sharing-platform-product-review.md) |
| 技术方案 | [`../../design-docs/content-sharing-platform-technical-design.md`](../../design-docs/content-sharing-platform-technical-design.md) |
| Prisma 说明与 ER | [`../../design-docs/content-sharing-platform-prisma-schema.md`](../../design-docs/content-sharing-platform-prisma-schema.md) |
| HTTP 规范（含本特性草案附录） | [`../../api/http-api-specification.md`](../../api/http-api-specification.md) |

## 当前阶段（对应 lifecycle 序号）

**5 需求评审 → 6 技术方案编写与 7 技术方案评审 → 8 代码开发**（见 [`../../development-lifecycle.md`](../../development-lifecycle.md)）。

---

## 步骤（按顺序勾选）

### A. 需求评审闭环（lifecycle 5）

- [ ] 按评审包召开评审会，填写 [`../../product-specs/content-sharing-platform-product-review.md`](../../product-specs/content-sharing-platform-product-review.md) **§4 评审结论**（或等效 Issue/PR 链接并回链至评审包）。
- [ ] 主需求文首 **Owner**、**最后评审日期** 已更新。
- [ ] 评审包 **§5 开放项** 中须进 PRD 的结论，已写入 [`../../product-specs/content-sharing-platform.md`](../../product-specs/content-sharing-platform.md)（修订以 Git 为准）。

### B. 技术方案定稿（lifecycle 6–7）

- [ ] 走读技术方案全文；与主需求 **§6 验收标准** 逐条可对齐。
- [ ] 闭合技术方案 [**第 14 节需确认项**](../../design-docs/content-sharing-platform-technical-design.md#csp-pending-confirmations)（结论写入该节或 ADR / PR 描述并链回）。
- [ ] 技术方案 [**第 12 节开放问题**](../../design-docs/content-sharing-platform-technical-design.md) 中须在 MVP 前定的项，已指定 Owner 与截止时间或明确「实现后首版默认值」。
- [ ] 技术方案评审结论已记录（文末、Issue 或 PR）。

### C. 契约与门禁（与开发并行或略前置）

- [ ] [`http-api-specification.md`](../../api/http-api-specification.md) **§7.3 / §11**（锚点 `content-sharing-platform-api-draft`）与实现一致；新增/变更码已登记。
- [ ] 若 admin-web / mobile 与 server 共享校验结构，已按技术方案 **第 2 节** 评估是否抽取 `packages/*` 并在 [`../../design-docs/index.md`](../../design-docs/index.md) 登记。

### D. 实现里程碑（lifecycle 8+；与技术方案第 11 节对齐）

- [ ] **M0**：用户 + 占位内容 + 权益创建事务 + **真实兑换**（替换桩）；匿名读已发布（若 PRD 已覆盖）。
- [ ] **M1**：评论二层 + 加载更多 + 基础通知（站内信等）。
- [ ] **M2**：发布机审状态机（可桩）+ 平台下架/隐藏 + 审计落库与查询最小能力。
- [ ] **M3**：内容模板管理端 + Owner 整稿替换（不记选用审计）。
- [ ] **M4**：转让（码 + 卡片）+ 管理端转让记录 + 过期定时任务（业务时区与第 7 日 23:59:59 一致）。

**仓库内实现真源**：技术方案 [**第 15 节实现进展**](../../design-docs/content-sharing-platform-technical-design.md#csp-implementation-status)；每完成一块应同步更新该表，避免文档与代码脱节。

---

## 完成定义（本执行计划归档条件）

- [ ] 需求评审结论可追溯，主需求文首元数据完整。
- [ ] 技术方案已 **评审通过**（或团队等价标签），第 14 节需确认项无阻塞 MVP 的未决项。
- [ ] **D** 中 M0–M4 与 PRD 验收对齐的范围内已 **合并默认分支**（或拆分为多 PR 但本计划已勾选并注明 PR 链接）。
- [ ] 将本文件移至 `docs/exec-plans/completed/`（或保留副本），并在 `completed/README.md` 中登记（若仓库有该习惯）。

---

修订本执行计划以 Git 历史为准。
