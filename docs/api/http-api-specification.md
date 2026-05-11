# 前后端 HTTP API 规范（唯一正文 · MVP 1.0）

**文档基线：MVP 1.0**（与 [`../MVP.md`](../MVP.md) 一致）。本文定义 **`apps/server`（`@flasenc/server`）** 与 **`apps/admin-web` / `apps/mobile`** 之间的 HTTP API 约定，并包含 **`error.code` 登记表**。实现、联调、评审与测试均**以本文为准**。逐条修订履历不再在文末维护，以 **Git 历史** 为准；破坏性变更须在 PR 中说明并同步 [`../MVP.md`](../MVP.md) 相关索引（若影响「必读」范围）。

---

## 1. 适用范围与原则

| 项目 | 约定 |
|------|------|
| 协议 | **HTTPS**（生产强制）；本地开发可用 HTTP。 |
| 格式 | **JSON**，字符编码 **UTF-8**。 |
| `Content-Type` | 请求与响应正文均为 `application/json; charset=utf-8`（文件上传等例外单独约定 MIME）。 |
| 字段命名 | JSON 属性使用 **camelCase**（与 TypeScript / Nest 序列化一致）。 |
| 时间 | 传输统一为 **ISO 8601** 字符串，**UTC** 带 `Z` 后缀，例如 `2026-05-10T08:30:00.000Z`；除非需求明确要求，不在 JSON 中传本地时区偏移字符串。 |
| 布尔与空值 | 使用 JSON `true` / `false`；可选字段无值时传 **`null`** 或省略二选一须在接口文档中写死，**默认**：未设置的可选字段**省略**，已清空的可区分资源用 **`null`**。 |
| 金额与高精度数 | **不以二进制浮点传递金额**；使用 **字符串**（如 `"19.99"`）或 **整数最小货币单位**（如分），在接口文档中逐项声明。 |

---

## 2. URL、版本与资源风格

| 项目 | 约定 |
|------|------|
| 风格 | **REST 风格**：资源名复数、名词；动作型操作用子路径或动词在文档中明确（如 `POST .../actions/cancel`）。 |
| 前缀 | 对外 HTTP API 统一前缀 **`/api`**（若网关剥离前缀，以网关后实际路径为准，但须在环境说明中固定）。 |
| 版本 | 在路径中体现主版本：**`/api/v1/...`**（C 端）。破坏性变更通过 **`v2`** 并行暴露；`v1` 保留 deprecate 周期（由发布说明约定）。 |
| Nest 多应用（`@flasenc/server`） | **`apps/server/apps/front`**（C 端）全局前缀 **`/api/v1`**；**`apps/server/apps/admin`**（管理 API）全局前缀 **`/admin/v1`**。与 **§11** 资源表对照时：`front` 面路径照写；`admin` 面将表内 `/api/v1/...` 换为 **`/admin/v1/...`** 同后缀。 |
| 大小写 | URL path **全小写**，单词用 **kebab-case**（如 `/api/v1/user-profiles`）。 |

---

## 3. 请求约定

### 3.1 常用请求头

| 头名称 | 必填 | 说明 |
|--------|------|------|
| `Authorization` | 除匿名接口外 **必填** | 形式：`Bearer <access_token>`（具体鉴权方案见安全设计，不在本文写密钥）。 |
| `Content-Type` | 有 body 的 POST/PUT/PATCH **必填** | `application/json; charset=utf-8`。 |
| `Accept` | 建议 | `application/json`；服务端仅返回 JSON（除下载等特殊接口）。 |
| `X-Request-Id` | 建议 | 客户端生成的唯一 ID（UUID）；用于全链路排查；若缺省，服务端应生成并回传。 |

### 3.2 查询参数

- 布尔：`true` / `false` 字符串或小写，服务端须统一解析。  
- 列表：`ids=1&ids=2` 或 `ids=1,2`，**同一资源集合接口内保持一致**，并在 OpenAPI/接口清单中写明。  
- **分页（offset 模式）**（默认）：  
  - `page`：页码，**从 1 开始**。  
  - `pageSize`：每页条数，**默认与上限**在接口文档中声明（建议默认 `20`，上限 `100`，超出按上限截断或返回 400，选一种并写死）。  
- **分页（cursor 模式）**：用于大列表；参数名 `cursor`、`limit`；响应中带 `nextCursor`；选用时须在资源上单独约定。

### 3.3 请求体

- 与资源创建/更新相关的字段放在 JSON 根对象；**禁止**无约定的一层任意包装（如统一 `{ "payload": {} }`）除非全员采纳并写进本文。

---

## 4. 响应体（统一信封）

所有业务 JSON 响应（除健康检查、文档、原始文件流等豁免路径外）使用**同一顶层结构**，便于前端与移动端统一拦截与错误处理。

### 4.1 成功（HTTP 2xx）

```json
{
  "success": true,
  "data": {},
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- **`success`**：固定 `true`。  
- **`data`**：业务载荷；无体时可 `{}`、`null` 或省略 `data` 三选一，**全项目统一一种**（推荐：无数据时 `data` 为 `null` 或 `{}` 在资源级文档写明）。  
- **`traceId`**：与 `X-Request-Id` 或服务端生成 ID 对齐，便于日志关联。

### 4.2 失败（HTTP 4xx / 5xx）

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "登录已过期，请重新登录",
    "details": {}
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- **`success`**：固定 `false`。  
- **`error.code`**：**大写下划线** 机器可读枚举（见 **§7 错误码登记表**）；禁止用纯数字魔法串无文档对应。  
- **`error.message`**：人类可读；前端可对用户展示或映射为文案，**勿用于分支逻辑**（分支以 `error.code` 为准）。  
- **`error.details`**：可选；如字段校验错误：`{ "fields": { "email": ["格式不正确"] } }`（结构在接口文档中细化）。

### 4.3 HTTP 状态码与 `success` 的对应关系

| HTTP | 含义 | `success` | 典型 `error.code` |
|------|------|-----------|-------------------|
| 200 | 成功 | `true` | — |
| 400 | 请求参数/语义错误 | `false` | `BAD_REQUEST` / 业务前缀 |
| 401 | 未认证或 token 无效 | `false` | `AUTH_*` |
| 403 | 已认证无权限 | `false` | `FORBIDDEN` / 业务前缀 |
| 404 | 资源不存在 | `false` | `NOT_FOUND` |
| 409 | 状态冲突（重复创建等） | `false` | `CONFLICT` |
| 422 | 语义正确但**校验失败**（如表单字段） | `false` | `VALIDATION_*` |
| 429 | 限流 | `false` | `RATE_LIMITED` |
| 500 | 未捕获服务端错误 | `false` | `INTERNAL_ERROR`（对用户展示泛化文案） |

**说明**：业务上「预期内的失败」（如库存不足）优先用 **4xx + 明确 `error.code`**，避免滥用 200 包错误体。

---

## 5. 列表与分页响应（`data` 内约定）

列表类接口的 `data` 推荐统一为：

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 137
  },
  "traceId": "..."
}
```

- **`items`**：当前页记录数组。  
- **`page` / `pageSize` / `total`**：offset 分页；若某接口使用 cursor，在接口文档中替换为 `items` + `nextCursor` 等并保持一致性类别（同模块内不要混用无文档说明）。

---

## 6. 幂等与重试

- **写操作**：对「重复提交应等价一次」的接口（如创建支付单），要求客户端传 **`Idempotency-Key`**（UUID），服务端去重；是否启用按接口清单标注。  
- **GET**：必须幂等；**不得**在 GET 中产生副作用。

---

## 7. `error.code` 命名与登记表

### 7.1 命名规则

- 格式：`DOMAIN_REASON` 全大写下划线，例如 `AUTH_TOKEN_EXPIRED`、`ORDER_OUT_OF_STOCK`。  
- **新增业务码**：须先在下表追加一行（**code、HTTP、含义、是否可对用户展示 message**），再用于线上响应。  
- 禁止复用含义冲突的同一 `code`。

### 7.2 通用错误码（全项目复用）

| `error.code` | HTTP | 含义 | 可对用户展示 `message` |
|--------------|------|------|-------------------------|
| `INTERNAL_ERROR` | 500 | 未预期服务端错误 | 否（展示泛化文案） |
| `BAD_REQUEST` | 400 | 通用请求不合法 | 视情况 |
| `AUTH_UNAUTHORIZED` | 401 | 未携带或非法凭证 | 可 |
| `AUTH_TOKEN_EXPIRED` | 401 | 访问令牌过期 | 可 |
| `FORBIDDEN` | 403 | 无权限 | 可 |
| `NOT_FOUND` | 404 | 资源不存在 | 可 |
| `CONFLICT` | 409 | 资源冲突 | 可 |
| `VALIDATION_FAILED` | 422 | 校验失败，见 `error.details` | 可 |
| `RATE_LIMITED` | 429 | 触发限流 | 可 |

### 7.3 业务错误码（按域扩展）

**MVP 1.0**：内容分享平台等业务专用码与 **[§11.2 业务错误码表](#mvp-error-codes)** 一致；新增码须先在该表登记 **code / HTTP / 含义**，勿与 §7.2 语义冲突。客户端分支逻辑以 **`error.code`** 为准。

---

## 8. 安全与传输（摘要）

- 生产环境 **TLS 1.2+**；禁止在 URL query 中传递 **token / 密码**。  
- 敏感字段日志脱敏规则见 [`../SECURITY.md`](../SECURITY.md)。  
- CORS：由服务端按环境配置允许来源，**禁止** `*` 携带 credentials。

---

## 9. 契约与文档

- **对外接口**推荐维护 **OpenAPI 3**（随 `@flasenc/server` 构建产物或仓库内 YAML）。  
- 联调以 **本文 + OpenAPI** 为准；冲突时以 **已合并 PR 中的本文与代码** 为准。

---

## 10. 规范版本

| 版本 | 日期 | 说明 |
|------|------|------|
| **MVP 1.0** | 2026-05-12 | 冻结：第 1〜9 节 + 第 11 节与当前 `@flasenc/server` 及客户端约定对齐；细目修订以 Git 为准。 |

修订契约时：更新本文与 [`../MVP.md`](../MVP.md)，并在 PR 中说明前后端影响。

---

<a id="content-sharing-platform-api-draft"></a>

## 11. 附录：内容分享平台 API 与错误码（MVP）

以下为 **MVP 1.0** 与实现对齐的接口分组与 **`error.code`** 真源；与 **§7.3** 一致。破坏性变更须评审并考虑 **`/api/v2`** 或独立迁移说明。

### 11.1 资源分组与路径

资源段使用 **kebab-case** 复数名词，与 **§2** 一致。`{id}` 表示 UUID 或文档约定的稳定标识。**C 端**（`front`）表内路径前缀 **`/api/v1`**；**管理端**（`admin` Nest 子应用）实现时前缀 **`/admin/v1`**（见 **§2**「Nest 多应用」）。两子应用可部署在不同网关主机；若后续改为单前缀下的 `/api/v1/admin/...` 命名空间，须在 OpenAPI 与本文一并修订。

| 资源分组 | 部署面 | 方法与路径模式 | 说明 |
|----------|--------|----------------|------|
| **Auth / 会话** | `front` + `admin` | **双 token**：**access**（短 TTL，**`Authorization: Bearer`**）与 **refresh**（长 TTL，独立 **`JWT_REFRESH_SECRET`** 签名）。C 端：**`POST /api/v1/auth/register`**、**`POST /api/v1/auth/login`**、**`POST /api/v1/auth/wechat/mini-program`**（微信小程序 **`code`** 换会话，体 **`{ code }`**，响应与 **`login`** 一致）、**`POST /api/v1/auth/refresh`**（体 **`{ refreshToken }`**，返回新 **access**+**refresh** 轮换）；管理端：**`POST /admin/v1/auth/login`**、**`POST /admin/v1/auth/refresh`**（同上；仅 **`platformAdmin`**）。**`JWT_SECRET`** 签 **access**，**`sub`** 语义：C 端 **`member_users.id`**，管理端 **`users.id`**。**`logout`** 仍待实现 | 匿名读已发布内容走公开 `GET .../contents/...`，不列在本组。 |
| **会员资料 / 通知偏好** | `front` | **`GET /api/v1/auth/me`**、**`PATCH /api/v1/auth/me`**（须 Bearer；摘要含 **`displayName`**；**`email`** 对纯微信账号可为空串 **`""`**；PATCH：**`currentPassword`**+**`newPassword`** 成对改密且账号须已存在 **`passwordHash`**，否则 **`AUTH_PASSWORD_NOT_SET`**；**`displayName`** 可选字符串或 **`null`** 清空，二者至少其一；**`.strict()`**）；**`GET/PATCH /api/v1/member-notification-preferences`**（须 Bearer；体为可选 **`channelInApp`**、**`channelMiniProgram`** 布尔，PATCH 至少一项；GET 无行时按默认 **`true`/`false`** 合并，**`updatedAt`** 可为 **`null`**） | 评论通知渠道等；路径与字段以 OpenAPI 为准。 |
| **Entitlements / 兑换码** | `admin` | `POST /api/v1/content-entitlements`、`GET /api/v1/content-entitlements`、`GET /api/v1/content-entitlements/{entitlementId}`；`POST /api/v1/content-entitlements/{entitlementId}/redemption-codes`（生成码）；`POST /api/v1/redemption-codes/{codeId}/actions/invalidate`（置失效） | 创建权益时服务端事务创建占位 `Content`；列表筛选参数在接口清单中固定。 |
| **Redemption（兑换）** | `front` | `POST /api/v1/redemptions` 或 `POST /api/v1/redemption-codes/actions/redeem` | **须** `Authorization: Bearer`；体载 `{ "code": "..." }` 等；幂等键按 **§6** 在清单中标注。 |
| **Contents** | `front` + `admin` | **C 端**（`/api/v1`）：`GET`（匿名须 **`PUBLISHED` 或 `SUSPICIOUS_PUBLISHED`** 且 **`listingState=NORMAL`**；Owner 可读草稿等）、`PATCH`（Owner 草稿/退回态）、`POST .../submit-publish`（事务内 **`SUBMITTED`** + `moderation_jobs`=`QUEUED`；终态由机审 worker 异步落库，noop 行为见 **`CONTENT_MODERATION_NOOP_OUTCOME`**）。**管理端**（`/admin/v1`）：**`GET .../contents/{contentId}`**（平台复核只读，含 `body`、**`entitlementId`**）；**`GET .../contents/queues/suspicious`**（列表项含 **`entitlementId`**）；`POST .../actions/clear-suspicion` / **`mark-manually-rejected`**（仅 **`SUSPICIOUS_PUBLISHED`**）；`POST .../actions/unlist` / `hide` / `restore-listing`（下架/隐藏仅 **`PUBLISHED`/`SUSPICIOUS_PUBLISHED`**） | 上架态与 C 端匿名读规则对齐。 |
| **Templates** | `admin` + `front` | 管理端：`GET/POST /api/v1/content-templates`、`GET/PATCH/DELETE /api/v1/content-templates/{templateId}`、`POST /api/v1/content-templates/{templateId}/actions/shelf-on` / `.../shelf-off`（或 `PATCH` 表达上下架）；C 端：`GET /api/v1/content-templates`（仅上架）；`POST /api/v1/contents/{contentId}/actions/apply-template` | Owner **应用模板**为写 `Content` 的动作，路径挂在 `contents` 下便于鉴权。 |
| **Comments** | `front` | **`GET /api/v1/contents/{contentId}/comments`**（**`page`/`pageSize`**，默认 1/20，**`pageSize`≤100**；与 **`GET .../contents/{id}`** 同可见性）；**`POST .../contents/{contentId}/comments`**（须 Bearer；**`body`** JSON；可选 **`anchorId`** 串内回复、**`replyToCommentId`**；根评论不得带 **`replyToCommentId`**）；**`DELETE /api/v1/comments/{commentId}`**（作者或 **Owner** 软删 **`deletedAt`**，**200** `{ ok: true }`） | 二层串：`parentId` 恒为锚点 id；相关 **`error.code`** 见 §11.2。 |
| **Transfers** | `front` + `admin` | **`GET /api/v1/contents/{contentId}/transfers`**（须 Bearer；**仅 Owner**；**`page`/`pageSize`** 默认 1/20，**`pageSize`≤100**；**`createdAt` desc**；项含 **`id`**、**`method`**、**`status`**、**`expiresAt`**、**`createdAt`**、**`confirmedAt`**、**`revokedAt`**）。**`POST .../contents/{contentId}/transfers`**（须 Bearer；**仅 Owner**；体 **`{ "method": "TRANSFER_CODE" \| "CARD_SHARE" }`**，**`.strict()`**；内容须 **`PUBLISHED` 或 `SUSPICIOUS_PUBLISHED`** 且 **`listingState=NORMAL`**；**`201`** **`data`**：**`transferId`**、**`method`**、**`expiresAt`**；**`TRANSFER_CODE`** 额外一次性 **`transferCode`**；**`CARD_SHARE`** 额外一次性 **`cardToken`**）。**`POST /api/v1/transfers/{transferId}/actions/revoke`**（发起方、**`PENDING`**→**`REVOKED`**）。**`POST /api/v1/transfers/{transferId}/actions/confirm`**（非发起方；体 **须且仅能** 填 **`transferCode`** 或 **`cardToken`** 之一；成功 **`200`** **`{ ok: true, contentId }`** 且 **`Content.ownerMemberId`** 改为确认人）。**管理端**：**`GET /admin/v1/contents/{contentId}/transfer-records`**（**`AdminJwtAuthGuard`**；内容不存在或非法 UUID **404**；**`page`/`pageSize`** 默认 1/20、上限 100；**`createdAt` desc**；项含 **`id`**、**`contentId`**、**`fromMemberId`**、**`toMemberId`**、**`method`**、**`status`**、**`expiresAt`**、**`createdAt`**、**`confirmedAt`**、**`revokedAt`**；**不**含明文 **`transferCode`/`cardToken`**） | **同一内容一条 `PENDING`**；**`expiresAt`** 由服务端按业务时区规则计算（实现见 **`libs/shared`** **`transferExpiresAtShanghai`**）；确认接口校验过期；**`TransferExpiryProcessorService`**（约 **60s** **`@Interval`**）将仍 **`PENDING`** 且已过 **`expiresAt`** 的转让单批置 **`EXPIRED`**（审计 **`CONTENT_TRANSFER_EXPIRE_JOB`**，`actor*` 为空）。 |
| **Notifications** | `front` | **`GET /api/v1/in-app-notifications`**（须 Bearer；**`page`** / **`pageSize`** 分页，**`onlyUnread`**=`true`/`false`/`1`/`0` 筛未读）、**`PATCH .../in-app-notifications/{notificationId}`**（已读，**幂等**；非本人或非法 id 形态 **`404 NOT_FOUND`**）；服务端在 **兑换成功**、**机审终态** 等路径 **同事务** 写入站内信（**`channelInApp=false`** 时跳过） | MVP 路径以实现为准。 |
| **Audit** | `admin` | **`GET /admin/v1/audit-logs`**：`page`（默认 1）、`pageSize`（默认 20，最大 100）、`action`、`targetType`、`targetId`、`actorUserId`、`actorMemberId`（UUID）、`from`/`to`（ISO8601，筛 `createdAt`） | 须 **`platformAdmin`**（`AdminJwtAuthGuard`）；导出若走异步另列清单。 |

### 11.2 业务错误码（内容分享域，MVP）

<a id="mvp-error-codes"></a>

下表为当前实现使用的业务码；**HTTP** 列以实际响应为准。新增或语义变更须同步 **§7.3** 与实现。

| `error.code` | HTTP | 含义 | 可对用户展示 `message` |
|--------------|------|------|-------------------------|
| `CONTENT_REDEMPTION_AUTH_REQUIRED` | 401 | 历史草案名；C 端未带凭证已实现为 **`AUTH_UNAUTHORIZED`**（§7.3），勿在新客户端依赖本字符串 | 可 |
| `AUTH_INVALID_TOKEN` | 401 | JWT 缺失、过期、签名无效，或 `sub` 非法 / 对应用户不存在（C 端兑换等受保护路由） | 可 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 登录邮箱或密码错误（对外统一文案，不区分「用户不存在」） | 可 |
| `AUTH_REFRESH_INVALID` | 401 | **`refreshToken`** 缺失、过期、签名无效、**`sub`** 非法，或管理端刷新时用户已非 **`platformAdmin`** / 用户不存在 | 可 |
| `AUTH_EMAIL_TAKEN` | 409 | 注册邮箱已被占用 | 可 |
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 | 已登录会员改密时 **`currentPassword`** 与库中不一致 | 可 |
| `AUTH_NEW_PASSWORD_REUSE` | 400 | 新密码与当前密码相同（bcrypt 比对命中当前哈希） | 可 |
| `AUTH_PASSWORD_NOT_SET` | 400 | 账号未设置登录密码（如纯微信注册）却提交改密字段 | 可 |
| `AUTH_WECHAT_MINI_PROGRAM_NOT_CONFIGURED` | 503 | 未配置 **`WECHAT_MINI_PROGRAM_APPID`** / **`WECHAT_MINI_PROGRAM_SECRET`** | 可 |
| `AUTH_WECHAT_CODE_INVALID` | 400 | 微信小程序 **`code`** 无效、过期或已使用 | 可 |
| `AUTH_WECHAT_UPSTREAM_ERROR` | 502 | 调用微信 **`jscode2session`** 失败或返回不可恢复业务错误 | 可 |
| `ADMIN_AUTH_REQUIRED` | 401 | 管理端受保护路由未带 `Authorization: Bearer` | 可 |
| `ADMIN_FORBIDDEN` | 403 | JWT 有效但当前用户非 **`platformAdmin`**（管理端写操作） | 可 |
| `CONTENT_REDEMPTION_CODE_NOT_FOUND` | 404 | 兑换码不存在或哈希不匹配（与「已失效」「已使用」区分，见相邻行） | 可 |
| `CONTENT_REDEMPTION_CODE_INVALIDATED` | 400 | 兑换码已被平台置失效 | 可 |
| `CONTENT_REDEMPTION_CODE_ALREADY_USED` | 409 | 一码一用：已成功兑换或并发下未抢到更新 | 可 |
| `CONTENT_ENTITLEMENT_NOT_FOUND` | 404 | 管理端引用的内容权益 id 不存在 | 可 |
| `CONTENT_REDEMPTION_CODE_PLAIN_CONFLICT` | 409 | 管理端指定明文兑换码与库内已有哈希冲突（换明文后重试） | 可 |
| `COMMENT_DEPTH_LIMIT_EXCEEDED` | 400 | 评论第三层/深度规则违反（仅允许二层结构） | 可 |
| `CONTENT_TRANSFER_SELF_NOT_ALLOWED` | 400 | 受让人与转让人为同一账号 | 可 |
| `CONTENT_TRANSFER_EXPIRED` | 400 或 409 | 转让邀约已过 `expiresAt`（第 7 自然日截止后） | 可 |
| `CONTENT_TRANSFER_PENDING_CONFLICT` | 409 | 同一内容已存在 `pending` 转让单 | 可 |
| `CONTENT_TRANSFER_SECRET_MISMATCH` | 400 | 确认时 **`transferCode`** 或 **`cardToken`** 与库内 hash 不一致 | 可 |
| `CONTENT_TRANSFER_FORBIDDEN_STATE` | 409 | 内容非可转让上架态（非 **`PUBLISHED`/`SUSPICIOUS_PUBLISHED`** 或 **`listingState`≠`NORMAL`**） | 可 |
| `CONTENT_TRANSFER_INVALID_STATE` | 409 | 撤销/确认时转让单非 **`PENDING`**（已确认、已撤销等）；**确认**路径下若已为 **`EXPIRED`**（含定时任务落库）则用 **`CONTENT_TRANSFER_EXPIRED`**（**400**），**不**用本码 | 可 |
| `CONTENT_TEMPLATE_NOT_FOUND` | 404 | 模板不存在或已硬删 | 可 |
| `CONTENT_TEMPLATE_NOT_AVAILABLE` | 400 或 403 | 模板未上架/已下架，不可选用（与「未找到」区分） | 可 |
| `CONTENT_OWNER_ACTION_FORBIDDEN` | 403 | 非当前 Owner 的前 Owner 或其他主体执行仅 Owner 可做的操作 | 可 |
| `CONTENT_VALIDATION_FAILED` | 422 | 内容正文/块结构等业务校验失败（`error.details` 细化字段） | 可 |
| `CONTENT_PATCH_FORBIDDEN_STATE` | 409 | 当前 `publishStatus` 不允许 Owner 编辑（如已 `PUBLISHED`） | 可 |
| `CONTENT_SUBMIT_PUBLISH_FORBIDDEN_STATE` | 409 | 当前 `publishStatus` 不允许再次提交发布（如已 `PUBLISHED`） | 可 |
| `CONTENT_PLATFORM_LISTING_ACTION_INVALID_STATE` | 409 | 非已发布/疑似已发布态，不可执行平台下架或紧急隐藏 | 可 |
| `CONTENT_PLATFORM_RESTORE_NOT_APPLICABLE` | 409 | 当前 `listingState` 非下架/隐藏，无法执行恢复上架（`NORMAL` 除外幂等） | 可 |
| `CONTENT_PLATFORM_SUSPICION_RESOLUTION_INVALID_STATE` | 409 | 当前非 **`SUSPICIOUS_PUBLISHED`**，不可执行消除疑似或人工标记失败 | 可 |
| `COMMENT_ANCHOR_REQUIRED` | 400 | 根评论不得带 **`replyToCommentId`**（串内回复另须有效 **`anchorId`**） | 可 |
| `COMMENT_ANCHOR_INVALID` | 400 | **`anchorId`** 非本内容下有效锚点（已删或非锚点行） | 可 |
| `COMMENT_REPLY_TARGET_INVALID` | 400 | **`replyToCommentId`** 不存在或不在同一锚点串内 | 可 |
| `CONTENT_COMMENT_DELETE_FORBIDDEN` | 403 | 删除者非作者且非内容 **Owner** | 可 |

**说明**：通用字段格式错误可用 **`VALIDATION_FAILED`**（§7.2）；内容 JSON 载体专项校验使用上表 **`CONTENT_VALIDATION_FAILED`**（与通用 422 区分）。

### 11.3 待定与扩展

产品或架构待定项见技术方案 [`../design-docs/content-sharing-platform-technical-design.md`](../design-docs/content-sharing-platform-technical-design.md) 文内「需确认项」锚点。
