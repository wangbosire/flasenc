# 产品评审包：内容分享平台（MVP）

与主需求 [`content-sharing-platform.md`](./content-sharing-platform.md) 配套；**结论**填本文 **§4** 或 Issue/PR，并回填主需求文首 **最后评审日期**。流程见 [`../development-lifecycle.md`](../development-lifecycle.md)。

---

## 1. 会议信息（会前）

| 项 | 内容 |
|----|------|
| 时间 / 形式 | |
| Owner / 记录人 | |
| 与会 | 产品 / 研发 / 测试 / 安全（按需） |

---

## 2. 会前阅读（主需求）

通读 [`content-sharing-platform.md`](./content-sharing-platform.md)，重点：**§2 范围**、**§4 规则总表**、**§5 验收**、**§7 机审**、**§10 评论**、**§13 审计**。

技术对照：[`../design-docs/content-sharing-platform-technical-design.md`](../design-docs/content-sharing-platform-technical-design.md)（**不替代**需求拍板）。

---

## 3. 议程（约 60–90 min）

| 时段 | 议题 |
|------|------|
| 开场 | MVP 边界对齐 |
| 中段 | 权益→兑换→编辑/模板→发布/机审→评论/通知→转让→平台→审计，逐条对照 **§5** 是否可测 |
| 末段 | 开放项决策或会后 Owner+截止日 |
| 收尾 | 填写 **§4** |

---

## 4. 评审结论（会后必填）

**结论**：通过 / 带条件通过 / 不通过  

**条件与修改项**：（列表或链 PR）

**准入下一环节**：

- [ ] 主需求文首 **Owner**、**最后评审日期** 已更新  
- [ ] 须进 PRD 的结论已合并进 [`content-sharing-platform.md`](./content-sharing-platform.md)  
- [ ] 仅方案侧事项已记入技术方案或 Issue  

**确认**（可改为 Issue 链接）：

| 角色 | 姓名 | 日期 |
|------|------|------|
| 产品 | | |
| 研发 | | |
| 测试 | | |

---

## 5. 开放项速查（会中拍板）

| 主题 | 评审需明确 |
|------|--------------|
| 下架后访客表现 | 404 / 下架页 / 等，选一种验收 |
| 紧急隐藏 vs 下架 | 恢复与话术底线 |
| 评论人工失败 | 物理删 / 逻辑删，产品是否指定 |
| 评论通知收件人 | MVP 是否「仅 Owner」即可 |
| 转让并发第二条 | 拒绝文案与引导 |
| 非目标渠道 | App 推送、邮件等是否明确不写 |

---

## 6. 评审通过后

更新 [`../exec-plans/active/content-sharing-platform.md`](../exec-plans/active/content-sharing-platform.md) **A 节**勾选，进入技术方案定稿与契约对齐（同文件 **B、C** 节）。
