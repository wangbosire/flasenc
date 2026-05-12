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
- **状态**：局部用 `useState`；跨布局 / 路由共享用 Zustand；服务端状态优先用 TanStack Query。
- **路由**：新增页面优先使用 `src/routes/` 文件路由，并同步侧边栏配置。

### 2.4 样式

- 优先 **shadcn/ui 组件 + Tailwind 工具类**；全局样式集中在 `src/styles/`。
- 设计令牌以 shadcn/ui CSS 变量为准；避免在业务组件内复制魔法色值。

### 2.5 与 `packages/ui`

- 复用 **`@repo/ui`** 时仅使用其 **公开 exports**；需要新通用组件时优先提到 `packages/ui` 再在各端引用。

### 2.6 命令

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
