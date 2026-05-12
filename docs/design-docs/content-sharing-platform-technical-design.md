# 技术方案：内容分享平台（权益兑换）

| 项 | 说明 |
|----|------|
| **需求真源** | [`../product-specs/content-sharing-platform.md`](../product-specs/content-sharing-platform.md) |
| **状态** | **MVP 1.0**；HTTP 与 `error.code` 真源为 [`../api/http-api-specification.md`](../api/http-api-specification.md)（通用错误码与 [内容分享平台附录](../api/http-api-specification.md#content-sharing-platform-api-draft)）；重大变更须评审并同步该文与 [`../MVP.md`](../MVP.md) |
| **仓库边界** | [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)、[`../BACKEND.md`](../BACKEND.md)、[`../FRONTEND.md`](../FRONTEND.md)、[`../SECURITY.md`](../SECURITY.md) |

---

## 1. 目标与范围（技术视角）

在 **不改变 monorepo 依赖方向** 下，为 **`apps/mobile`**、**`apps/admin-web`**、**`apps/server`**（Nest 子应用 `admin` / `front`）给出可实现方案，覆盖 PRD：权益与占位内容、兑换码与兑换、内容发布与机审分支、评论（二层 + 加载更多）、平台干预、审计、内容模板、评论通知偏好、内容 Owner 转让（含第 7 个自然日 **23:59:59** 截止与转让记录查询）。

**机审供应商与模型不定稿**：只定义接入面（同步/异步回调、状态落库、与 PRD 机审分支映射）。

---

## 2. 系统与部署视图

| 组件 | 职责 |
|------|------|
| **`apps/server/apps/front`** | C 端 HTTP：匿名读已发布、登录兑换/编辑/发布/评论/转让/通知偏好等；全局前缀 **`/api/v1`**。 |
| **`apps/server/apps/admin`** | 管理端 HTTP：权益与码、模板 CRUD、审核队列、下架/隐藏、审计查询、转让记录只读等；**独立鉴权与 RBAC**；全局前缀 **`/admin/v1`**。 |
| **`apps/admin-web`** | 管理端 UI；仅调用 `admin` API。 |
| **`apps/mobile`** | C 端 UI；仅调用 `front` API；小程序订阅消息走各端 SDK + 后端落库/发券。 |

**共享契约**：若需同源 Zod schema，抽到 `packages/*` 并在 [index.md](./index.md) 增一行说明（见 [`../BACKEND.md`](../BACKEND.md)）。

---

## 3. 领域模型（逻辑聚合）

物理层见 [`content-sharing-platform-prisma-schema.md`](./content-sharing-platform-prisma-schema.md) 与 [`schema.prisma`](../../apps/server/libs/database/prisma/schema.prisma)。

| 聚合 | 核心要点 |
|------|----------|
| **User**（`users`） | 仅平台人员；管理端 JWT `sub`。 |
| **MemberUser**（`member_users`） | 仅 C 端会员；C 端 JWT `sub`；Owner、兑换人、评论作者、转让双方、通知收件人。可选 **`displayName`**（≤64）。 |
| **ContentEntitlement** | 与 **Content 1:1**；创建权益时 **原子创建** 占位内容；关联兑换码。 |
| **RedemptionCode** | **一码一用**；长期有效 + 手动失效；与 **转让凭证** 分表或分 `type`，校验逻辑禁止混用。 |
| **Content** | Owner 随兑换/受让变更；**无** `templateId` 外键（模板与内容分治）。 |
| **ContentVersion**（可选） | 机审重提/下架回滚；MVP 可合并入 `Content` 并文档说明限制。 |
| **ContentTemplate** | 上架/下架/软删；对外「删除不可恢复」语义。 |
| **Comment** | **深度恒为 2**；`anchorId` / `parentId` / `replyToCommentId` 规则见下文第 5.1 节。 |
| **ModerationJob** | 关联 Content 或 Comment，结果枚举与 PRD 机审分支对齐。 |
| **AuditLog** | `actorUserId`（平台）/ `actorMemberId`（会员）二选一；覆盖 PRD 审计范围；**豁免**：Owner 选用模板。 |
| **MemberNotificationPreference** | 站内 / 小程序等渠道开关。 |
| **InAppNotification** | 站内信 MVP。 |
| **ContentTransfer** | 双方均为 MemberUser；**同一内容仅一条 PENDING**（唯一索引或状态机）。 |

**正文与模板载体**：建议 **JSON 文档模型**（块：`text` / `image` / `animation`），含 `version` 便于迁移；XSS/动画沙箱见 [`../SECURITY.md`](../SECURITY.md)。

---

## 4. Nest 模块划分（建议）

| 模块 | 主要职责 |
|------|----------|
| `Auth` / `Users` | 注册登录、会话、401/403。 |
| `Entitlements` | 创建权益 → 占位 `Content` 事务；生成/失效兑换码。 |
| `Redemption` | 已登录兑换；并发 **幂等**（唯一约束 + 重试安全）。 |
| `Contents` | Owner 读写、发布提交、机审结果、平台下架/隐藏。 |
| `Templates` | 管理端 CRUD；C 端只读上架；**应用模板** = 服务端覆盖 `Content.body`，**不记选用审计**。 |
| `Comments` | 二层校验、游标/分页加载更多、删评权限。 |
| `Moderation` | 机审端口 + noop/第三方实现、人工队列。 |
| `Transfers` | 发起（卡片 token + 转让码）、撤销、确认、过期 **定时任务**（业务时区算 `expiresAt`）。 |
| `Notifications` | 偏好；评论后 **异步** 站内信/小程序订阅任务。 |
| `Audit` | 拦截器或领域事件统一落库；管理端查询。 |

入口 **Zod parse**、响应信封见 [`../BACKEND.md`](../BACKEND.md) 与 HTTP 规范。

---

## 5. 关键算法与规则

### 5.1 评论二层（对话串）

- **写入**：若 `replyToCommentId` 存在，仍强制 `parentId = anchorId`（锚点评论 ID）；拒绝 `parentId` 指向非锚点。  
- **读取**：按 `anchorId` 分组或按 `createdAt` + 锚点成串。  
- **列表**：游标分页（`commentId` + `createdAt`）优先。

### 5.2 转让截止（第 7 个自然日 23:59:59）

- **时区**：`APP_BUSINESS_TIMEZONE`（默认 `Asia/Shanghai`）。  
- **计算**：以转让单 `createdAt` 的当地日历日为第 1 日；`expiresAt = startDate.plusDays(6).atTime(23, 59, 59)`（业务时区）。  
- **校验**：确认接口比较 `now()` 与 `expiresAt`；定时任务将超时 `pending` → `expired` 并写审计。

### 5.3 卡片分享

短期 JWT 或随机 token，与转让单绑定；确认时校验签名与未撤销。

### 5.4 机审（待定实现）

`ModerationProvider`：`submitContent` / `submitComment` → `jobId`，回调或轮询更新；MVP 可提供 **通过/拦截** 桩。

---

## 6. API 与错误码

路径形状、分页、信封见 HTTP 规范；业务 **`error.code`** 见规范附录与 **第 7.3 节** 草案表。

| 分组 | 能力摘要 |
|------|----------|
| Auth / User | 注册、登录、登出、资料与通知偏好 |
| Entitlements / Codes | 管理端创建权益、生码、失效；列表筛选 |
| Redemption | `POST` 兑换（Bearer） |
| Contents | Owner 草稿、提交发布、公开读；平台 unlist/hide/restore |
| Templates | 管理 CRUD/上下架/删除；C 端上架列表；Owner 应用模板 |
| Comments | 锚点/串内回复、列表、删除 |
| Transfers | 发起、撤销、确认；管理端按 `contentId` 转让记录 |
| Notifications | 站内信；小程序一次性订阅落库 |
| Audit | 管理端分页筛选 |

---

## 7. 鉴权与 RBAC（摘要）

| 能力 | 条件 |
|------|------|
| 占位编辑 / 发布 / 模板应用 / 转让发起 | `Content.ownerMemberId === currentMemberId` |
| Owner 删评 | 同上 |
| 平台模板删除、审核队列等 | 角色与 Guard（与产品 RBAC 映射） |
| 转让记录只读 | 如 `content:audit` / `transfer:read` |

转让完成后 `ownerMemberId` 变更，前 Owner 自然失去 Owner 级接口。

---

## 8. 安全与非功能

富文本/动画净化与白名单；码与凭证仅存 **hash**、日志脱敏；兑换/确认/发评 **限流**（[`../SECURITY.md`](../SECURITY.md)）；`X-Request-Id` / `traceId` 关联审计与业务日志。

---

## 9. 前端分工

| 端 | 要点 |
|----|------|
| **admin-web** | 权益与码、模板、审核队列、干预、转让记录、审计检索；错误码映射见 [`../FRONTEND.md`](../FRONTEND.md)。 |
| **mobile** | 兑换、编辑发布、模板、评论串与加载更多、转让卡片/码、通知与小程序订阅引导。 |

---

## 10. 测试与验收

E2E 至少覆盖：权益 → 占位 → 兑换 → Owner 编辑 → 发布（机审桩）；评论第三层拒绝；转让全流程与过期 job；契约与 OpenAPI 与 HTTP 规范同步。

---

## 11. 里程碑建议

1. **M0**：用户 + 占位 + 兑换 + 公开读（无评）。  
2. **M1**：评论二层 + 加载更多 + 基础通知。  
3. **M2**：机审状态机（可桩）+ 平台下架/隐藏 + 审计。  
4. **M3**：模板 + 应用（整稿替换）。  
5. **M4**：转让（码 + 卡片）+ 转让记录 + 定时过期。

数据迁移在 M0 定稿主键与外键。

---

## 12. 开放问题（回填 PRD 或本稿）

机审供应商与疑似阈值；`Content.body` JSON Schema 版本与兼容；小程序订阅模板 ID 与审核材料；审计保留周期与导出。

---

## 13. 变更记录（摘要）

| 日期 | 变更 |
|------|------|
| 2026-05-11 | 初稿：领域、模块、API 占位、转让时刻、安全、里程碑；接 HTTP 规范附录；`libs/http`、Prisma/MySQL、Prisma 说明文档。 |
| 2026-05-12 | C/admin JWT 与模型拆分（`User` / `MemberUser`）；兑换落库、权益生码、转让 MVP、过期任务、管理端转让记录与疑似队列；`displayName`、通知偏好、评论、站内信、审计检索等（细节见第 15 节与 Git）。 |

---

<a id="csp-pending-confirmations"></a>

## 14. 需确认项（PM / 架构）

与第 12 节互补：本条偏可交付细节，定稿前建议书面确认。

- **转让截止各端展示**：是否统一「北京时间」文案与「第 7 自然日 23:59:59」字面说明。  
- **`ContentVersion` 是否纳入 MVP**：单版本合并入 `Content` 时，机审重提与回滚边界是否接受简化。  
- **小程序订阅**：类目模板 ID、订阅时机与评论展示对齐、失败重试与文案责任方。  
- **管理端命名空间（已决）**：`admin` 使用 **`/admin/v1`**，与 `front` 的 **`/api/v1`** 并列；同源时由网关路由。  
- **`CONTENT_TEMPLATE_NOT_AVAILABLE` 与 `NOT_FOUND`**：下架模板选用时的 HTTP 与文案边界。  
- **`CONTENT_TRANSFER_EXPIRED`**：草案允许 400 或 409，须与前端统一。  
- **审计**：保留周期、是否导出日志平台、仅 DB 时的查询预期（与第 12 节重叠处以评审结论为准）。

---

<a id="csp-implementation-status"></a>

## 15. 实现进展（仓库真源）

**原则**：下列为截至文稿时的实现摘要；**接口细节、状态机与错误码以代码及 [`../api/http-api-specification.md`](../api/http-api-specification.md) 附录为准**。完成大块功能后应更新本节，避免文档与代码脱节（见 [`../exec-plans/active/content-sharing-platform.md`](../exec-plans/active/content-sharing-platform.md)）。

### 基础设施

- **`libs/http`（`@app/http`）**：`HttpCoreModule`、成功/失败信封、`X-Request-Id`/`traceId`、`GET .../health`、`DomainHttpException`、`ZodBodyPipe`、信封类型。  
- **`libs/database`**：Prisma + MySQL；`DatabaseModule` / `PrismaService`；表定义见 [`schema.prisma`](../../apps/server/libs/database/prisma/schema.prisma)；ER 与字段说明见 [Prisma 设计文档](./content-sharing-platform-prisma-schema.md)。  
- **`apps/server/apps/front` | `admin`**：`front` 前缀 `api/v1`，`admin` 前缀 `admin/v1`；均挂载 `HttpCoreModule`、`DatabaseModule`。  
- **HTTP `traceId`**：`RequestTraceMiddleware` 写 `req.traceId` 与 `X-Request-Id`；与审计 `traceId` 同源。

### C 端认证与资料

- **`POST /api/v1/auth/register`**、**`POST /api/v1/auth/login`**：邮箱 + 密码（bcrypt）；JWT `sub` = **`MemberUser.id`**（`JWT_SECRET`）；**`GET/PATCH /api/v1/auth/me`**：`displayName`（可 `null`）、改密同事务、`.strict()`；错误码见 HTTP 规范（如 `AUTH_EMAIL_TAKEN`、`AUTH_CURRENT_PASSWORD_INVALID` 等）；注册失败/登录失败/资料与密码变更等写 **`AuditLog`**（规则见代码与单测）。

### 通知偏好与站内信

- **`GET/PATCH /api/v1/member-notification-preferences`**：默认渠道、upsert、**`MEMBER_NOTIFICATION_PREFERENCE_UPDATE`**。  
- **`GET /api/v1/in-app-notifications`**、**`PATCH .../{id}`**（已读幂等）；兑换成功、机审终态等写入（`channelInApp=false` 时跳过插入）；详见实现与规范。

### 评论

- **`GET/POST .../contents/{contentId}/comments`**、**`DELETE /api/v1/comments/{commentId}`**：`OptionalJwtAuthGuard` / `JwtAuthGuard`、二层与 `anchorId`/`parentId`/`replyToCommentId` 规则、作者或 Owner 软删、审计 **`CONTENT_COMMENT_CREATE`** / **`CONTENT_COMMENT_DELETE`**。

### 兑换与内容读写/发布

- **`POST /api/v1/redemption-codes/actions/redeem`**：`JwtAuthGuard`、事务抢码、更新 Owner / `placeholderKind`；成功/失败审计与错误码见规范。  
- **`GET/PATCH .../contents/{id}`**、**`POST .../submit-publish`**：可见性规则（访客/Owner）、Owner 可编辑状态集、提交后入队 **`moderation_jobs`**；**`ContentModerationProcessorService`** + **`NoopContentModerationOutcomeProvider`** 落 **`PUBLISHED` / `MACHINE_REJECTED` / `SUSPICIOUS_PUBLISHED`** 等。

### 转让（C 端）

- **列表/发起/撤销/确认**：状态前置（如 `PUBLISHED`/`SUSPICIOUS_PUBLISHED` 且 `listingState=NORMAL`）、**`TRANSFER_CODE`** / **`CARD_SHARE`** 的 hash 前缀、**`transferExpiresAtShanghai`**、**`409 CONTENT_TRANSFER_PENDING_CONFLICT`** 等；确认路径 **`POST .../actions/confirm`**；错误码含 **`CONTENT_TRANSFER_EXPIRED`**、**`CONTENT_TRANSFER_SECRET_MISMATCH`**、**`422`** 与 Zod 体校验等（以规范为准）。  
- **`TransferExpiryProcessorService`**：`PENDING`→`EXPIRED`，审计 **`CONTENT_TRANSFER_EXPIRE_JOB`**。

### 管理端

- **`POST /admin/v1/auth/login`**：**`AdminJwtAuthGuard`** + **`User.platformAdmin`**。  
- **权益与码**：主路径 **`POST /admin/v1/content-entitlements/redemption-codes`** 同事务创建占位内容、权益和兑换码；保留先建权益再发码的兼容接口；`createdByUserId` 与审计同事务。  
- **内容处置与复核**：**`GET .../contents`** 内容列表；**`unlist` / `hide` / `restore-listing`**；**`GET .../contents/{id}`** 平台只读；**`GET .../contents/queues/suspicious`** 与 **`clear-suspicion` / `mark-manually-rejected`**。  
- **转让记录**：**`GET .../contents/{contentId}/transfer-records`**（分页，不暴露明文码/token）。  
- **审计检索**：**`GET /admin/v1/audit-logs`**（query 校验与分页）。

### 审计与测试

- **`AuditLog`**：`AuditLogService`、`appendAuditLogDetached`、定时任务路径；动作枚举覆盖会员/平台登录与业务操作、机审 worker、转让过期任务等（完整列表以代码为准）。  
- **测试**：`libs/http`、`libs/shared`（含 **`transferExpiresAtShanghai`**）、redemption/转让等 Controller 与 **E2E**（MySQL，见 [`../BACKEND.md`](../BACKEND.md)）。

### 下一步（实现）

真实机审供应商；可选人工复核流；细粒度 RBAC；刷新令牌/登出；`platformAdmin` 安全授予流程；HTTP 草案码评审并入规范正文。
