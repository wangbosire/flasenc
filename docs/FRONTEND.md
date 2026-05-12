# 前端开发规范

本文约定 **`apps/admin-web`** 与 **`apps/mobile`** 的共同原则及各自实践，与 [`ARCHITECTURE.md`](../ARCHITECTURE.md)、[`api/http-api-specification.md`](api/http-api-specification.md)、[`DESIGN.md`](DESIGN.md) 一致。

---

## 1. 共同原则（admin-web + mobile）

### 1.1 与 API 规范对齐

- 所有后端请求须经过 **统一 HTTP 客户端**（封装 `fetch` 或 axios），在拦截器中处理：基址、`Authorization`、`X-Request-Id`、超时、以及 [`api/http-api-specification.md`](api/http-api-specification.md) 规定的 **`success` / `error` 信封**。
- **禁止**在业务页面内散落裸 `fetch(url)` 后自行解析多种形状；错误分支以 **`error.code`** 为准，文案可对 `message` 做映射。
- **环境**：API 基址、环境标识等来自 **环境变量**（如 Vite / uni-app 的 `import.meta.env`），禁止把生产地址写死在业务代码中。

### 1.2 类型与数据

- 对接口返回的 `data` 在边界处 **收窄类型**（类型断言、schema 校验二选一）；组件内部使用明确类型，避免 `any` 渗透。
- 列表、分页字段名与 [`api/http-api-specification.md`](api/http-api-specification.md) **§5** 保持一致。

### 1.3 代码风格与质量

- 遵循各应用已配置的 **ESLint / Biome**；提交前跑 `pnpm --filter <pkg> lint`（或根 `pnpm lint`，以实际接入为准）。
- **可测**：纯逻辑尽量抽成与框架无关的函数模块，便于单测；UI 行为用组件测试覆盖关键路径。

### 1.4 资源与性能

- 图片、字体等静态资源走构建工具约定目录；大图懒加载、列表虚拟化按产品要求在方案中注明。
- 避免在渲染热路径上创建大对象或非必要订阅；路由级按需加载按框架能力启用。

### 1.5 注释与逻辑同步

- **须编写注释**：对非显而易见的业务分支、状态与副作用、与接口/错误码的约定、性能或安全相关取舍，在 **紧邻实现处** 用单行或块注释说明意图；避免「注释复述代码字面含义」。
- **逻辑更新须同步更新注释**：行为、条件、数据流或对外契约变更时，**一并修订**相关注释；删除或替换旧逻辑时，**删除或改写**已失效注释，**禁止**保留误导性说明。
- **语言**：与所在文件既有风格一致；新文件默认与团队代码评审约定一致（中文或英文择一，**同一文件内不混排**）。

---

## 2. `apps/admin-web`（`@flasenc/admin-web`）

### 2.1 技术栈

- **React 19**、**Vite**、**TanStack Router**、**TanStack Query**、**shadcn/ui**（Tailwind CSS v4 + Radix UI）、**Zustand**、**ESLint**、**Vitest**、**TypeScript**。当前骨架基于 [`satnaing/shadcn-admin`](https://github.com/satnaing/shadcn-admin) 改造。

### 2.2 目录与职责（推荐演进方向）

| 区域 | 约定 |
|------|------|
| `src/routes/` | TanStack Router 文件路由；认证后页面挂在 `_authenticated` 下。 |
| `src/features/` | 业务功能页面与组件；从上游模板保留的示例页应逐步替换为 Flasenc 业务语义。 |
| `src/components/ui/` | shadcn/ui 组件副本；上游有 RTL 与组件细节改动，升级时按 README 手工合并。 |
| `src/api/`、`src/lib/` | **唯一 HTTP 出口**（`src/api/http.ts` 的 **`adminRequest`** + 领域模块，如 **`admin-auth`**、**`content-admin-detail`**、**`content-transfer-records`**）；基址见 **`PUBLIC_ADMIN_API_ORIGIN`** 或开发同源代理（`apps/admin-web/vite.config.ts` **`/admin`**）。 |
| `src/stores/` | Zustand 状态；当前管理端 access / refresh token 存放在 `auth-store`。 |

### 2.3 React 实践

- 优先 **函数组件**；副作用集中在 `useEffect` 或与数据库无关的可预测位置。
- 可组合逻辑用 **自定义 Hook**（`use*`），命名以领域含义为准。
- **先看依赖再开发**：开发新功能前先检查 `apps/admin-web/package.json` 与既有 `src/` 用法；优先复用已安装的 TanStack、shadcn/ui、Radix、react-hook-form、zod、sonner、Zustand、lucide-react 等能力，避免重复造轮子。
- **状态**：局部表单草稿用 `useState` 或 react-hook-form；跨布局 / 路由共享用 Zustand；服务端状态必须优先用 **TanStack Query**（`useQuery` / `useMutation` / `invalidateQueries`），避免在业务组件中手写加载、缓存、重试与刷新逻辑。
- **路由**：新增页面优先使用 `src/routes/` 文件路由；是否出现在后台侧栏由菜单管理配置决定，不再直接把路由文件等同于导航入口。

### 2.4 管理后台菜单

- **数据源**：`apps/admin-web` 的侧栏与命令面板优先读取管理端接口 **`GET /admin/v1/menu-items/tree`**；接口失败或返回空菜单时使用 `src/components/layout/data/sidebar-data.ts` 作为兜底。
- **映射层**：服务端只返回可序列化字段（如 `title`、`routePath`、`iconKey`、`sortOrder`、`enabled`、`parentId`）；前端在 `src/lib/admin-menu-map.ts` 转换为现有 `SidebarData`，并在 `src/lib/admin-menu-icons.ts` 将 `iconKey` 映射为 lucide 组件。
- **链接策略**：菜单链接允许填写站内路径或外链；站内路径走 TanStack Router `Link` / `navigate`，外链由 `src/lib/admin-menu-links.ts` 识别并以新标签打开。`src/lib/registered-admin-routes.ts` 仅作为菜单表单输入建议，不是校验白名单。
- **菜单管理页**：`/system/menus` 提供创建、编辑、启停、删除、同级排序；变更成功后须同时刷新菜单列表 query 与侧栏树 query，确保侧栏和命令面板同步。

### 2.5 内容与兑换码页面

- **内容列表**：`/contents` 使用 **`GET /admin/v1/contents`**，展示内容、发布态、上架态、权益 id、兑换码数量和最近兑换码记录；列表只复制记录 id，明文 `plainCode` 仅能在生成页响应中复制。
- **内容操作**：内容列表提供权限编辑（`publishStatus` / `listingState`）和发起审核操作；成功后须刷新 `['admin', 'contents']` 相关 query。
- **生成兑换码**：`/redemption-codes` 使用 **`POST /admin/v1/content-entitlements/redemption-codes`**，一次提交创建内容、权益和兑换码；`plainCode` 只在本次响应展示，页面须便于复制。

### 2.6 样式

- 优先 **shadcn/ui 组件 + Tailwind 工具类**；全局样式集中在 `src/styles/`。
- 设计令牌以 shadcn/ui CSS 变量为准；避免在业务组件内复制魔法色值。

### 2.7 与 `packages/ui`

- 复用 **`@repo/ui`** 时仅使用其 **公开 exports**；需要新通用组件时优先提到 `packages/ui` 再在各端引用。

### 2.8 命令

见 [`references/repo-commands-llms.txt`](references/repo-commands-llms.txt) 中 `--filter @flasenc/admin-web`。

---

## 3. `apps/mobile`（`@flasenc/mobile`）

### 3.1 技术栈

- **uni-app**（Vue 3）、**Vite**、条件编译多端；**vue-i18n** 用于文案。

### 3.2 目录与职责

| 区域 | 约定 |
|------|------|
| `src/pages/` | 页面路由；**页面组件保持较薄**，复杂逻辑下沉到 `composables/` 或 `src/utils/`。 |
| `src/components/` | 可复用展示组件。 |
| HTTP 封装 | 与 admin-web 相同：**单文件/单模块出口**调用后端，遵守 API 信封与错误码。 |

### 3.3 Vue 实践

- 新页面与复杂组件优先 **`<script setup lang="ts">`**。
- **Props / Emit** 显式声明类型；与后端对齐的 DTO 可放在 `src/types/` 或按功能域分文件。
- 平台差异使用 **条件编译**（`#ifdef` / `#endif`），避免运行时字符串判断平台散落各处。

### 3.4 类型检查

- 修改后执行 `pnpm --filter @flasenc/mobile run type-check`；与根 `pnpm check-types` 并行存在时，**合并前至少执行一次** mobile 侧检查。

### 3.5 命令

见 [`references/repo-commands-llms.txt`](references/repo-commands-llms.txt) 中 `@flasenc/mobile`；H5 开发常用 `dev:h5`。

---

## 4. 与流程的衔接

需求、验收与提测说明见 `docs/product-specs/` 与 [`development-lifecycle.md`](development-lifecycle.md)。
