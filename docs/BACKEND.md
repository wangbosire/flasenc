# 后端开发规范（`apps/server`，`@flasenc/server`）

本文约定 **NestJS** 多应用场景下的实现标准，与 [`ARCHITECTURE.md`](../ARCHITECTURE.md)、[`api/http-api-specification.md`](api/http-api-specification.md)、[`DESIGN.md`](DESIGN.md)、[`SECURITY.md`](SECURITY.md) 一致。

---

## 1. 栈与仓库布局

- **框架**：NestJS 11，**Express** 适配器。
- **多应用**：源码位于 `apps/server/apps/`（如 `admin`、`front` 等），每个子应用有独立 `main.ts`、`*.module.ts`；**对外 HTTP 路径前缀**须符合 [`api/http-api-specification.md`](api/http-api-specification.md)：**C 端** `front` 为 **`/api/v1`**，**管理 API** `admin` 为 **`/admin/v1`**，在 `main.ts` 的 `setGlobalPrefix` 中统一配置。
- **单测 / E2E**：与各子应用 `src/`、`test/` 并列；新增模块时同步可运行的 `*.spec.ts` / `*.e2e-spec.ts`。

### 1.1 持久化（Prisma / MySQL，`libs/database`）

- **版本**：当前固定 **Prisma 5.22**（`prisma` 与 `@prisma/client` 同版本），以便在 Nest 内沿用 **`extends PrismaClient`** 的经典封装；若升级 **7.x**，须按官方指南接入 **驱动适配器** 与新的生成/配置方式。
- **Schema**：`libs/database/prisma/schema.prisma`，**方言**：MySQL；连接串 **`DATABASE_URL`**（不落库，见 [`SECURITY.md`](SECURITY.md)）。**表结构说明与 ER 图**见 [`design-docs/content-sharing-platform-prisma-schema.md`](design-docs/content-sharing-platform-prisma-schema.md)。**MySQL 列名**须为 **`snake_case`**（在 schema 中用 **`@map`**；Prisma Client / 业务代码仍用 camelCase 字段名）。
- **应用接入**：子应用 `imports: [DatabaseModule]`，注入 **`PrismaService`**（`@app/database`）；禁止在业务模块内 `new PrismaClient()`。
- **本地与 E2E（标准路径，零 Docker 依赖）**：在 **本机安装 MySQL**，创建库 **`flasenc`**，复制 `apps/server/.env.example` 为 **`.env`** 并填写真实 **`DATABASE_URL`**（用户名/口令以你本机为准；仓库示例口令仅协作占位）。**不要求安装 Docker**；日常开发、单测、E2E 均直连该实例即可。`jest.setup.ts` 与 `scripts/e2e-db-migrate-deploy.cjs` 仅在未设置 `DATABASE_URL` 时回落到与 `.env.example` 相同的占位连接串（若本机口令不同，**必须**配置 `.env`，否则会认证失败）。跑 **`test:e2e`** 前须保证库可达；`pretest:e2e` 会执行 **`prisma migrate deploy`**（应用 `libs/database/prisma/migrations/*`）。**日常改表**：在 `apps/server` 执行 **`pnpm run db:migrate:dev`**；**对齐已有迁移文件**（空库 / 新环境 / 生产）：**`pnpm run db:migrate:deploy`**。若本地曾仅用 `db push` 建表且无 `_prisma_migrations`，须清空库或 `prisma migrate resolve` / `migrate reset` 后再对齐迁移记录（勿对含生产数据的库随意 reset）。**`docker-compose.mysql.yml` 与 `pnpm db:compose:*` 为完全可选**：仅当有人想用容器临时起库时使用；**未安装 Docker 可忽略，不影响本仓库任一默认流程。**
- **构建**：`prebuild` 执行 **`prisma generate`**（仅需 schema，不要求数据库在线）。
- **连通性自检**（本机 MySQL 已启动、`DATABASE_URL` 已配置或沿用 `.env.example` 默认时）：在 `apps/server` 执行 **`pnpm run db:test-connection`**（`Prisma` `$connect`）；结果会写入 **`.db-connection-test-result.txt`**（已加入 `.gitignore`）。

---

## 2. 与前端、移动端的边界

- **admin-web / mobile** 仅通过 **HTTP** 调用本服务；禁止假设对方可 import 本仓库类型（共享类型进 `packages/*` 并在 `docs/design-docs/` 登记）。
- **传输与错误体**：必须遵守 [**`api/http-api-specification.md`**](api/http-api-specification.md)；新增 **`error.code`** 须在规范 **§7** 登记表追加后再用于生产响应。

---

## 3. 分层与职责

| 层次 | 职责 | 禁止 |
|------|------|------|
| **Controller** | 路由、HTTP 状态码、**Zod 解析入参**、调用 Service | 复杂业务规则、直接访问多表事务散落 |
| **Service** | 用例与领域逻辑、事务边界 | 操作 HTTP 头、Response 细节 |
| **Repository / 基础设施**（若有） | 持久化、第三方 API | 泄漏到 Controller 的 ORM 细节过多时可接受薄封装 |

- **Controller 保持薄**：入参校验通过后调用一个或多个 Service 方法；**统一响应信封**建议由 **全局拦截器 / 异常过滤器** 输出，避免每个方法手写 `{ success, data }`。
- **领域不变量**写在 Service（或领域模块），便于单测。

---

## 4. 输入校验与类型（**Zod**）

- **标准**：HTTP **请求体、query、params、headers（如需）** 的校验与形状定义一律使用 **[Zod](https://zod.dev/)**；不使用 `class-validator` 装饰器式 DTO 作为入参真源。
- **Controller 边界（推荐）**：用 **`nestjs-zod`** 的 **`createZodDto(schema)`** 生成 DTO 类，在方法上使用 **`@Body() dto: XxxDto`**、**`@Query() query: XxxDto`**；**`HttpCoreModule`** 已注册全局 **`DomainZodValidationPipe`**（`createZodValidationPipe`），校验失败抛出 **`DomainHttpException`**：**422** + **`VALIDATION_FAILED`** + **`details.fields`**（与历史 `ZodBodyPipe` / `ZodQueryPipe` 一致）。列表分页可复用 **`OffsetPageQueryDto`**（`@app/http`，与 `offsetPageQuerySchema` 同源）。
- **OpenAPI**：`main.ts` 中 **`setupHttpSwagger`** 在 **`SwaggerModule.createDocument`** 之后对文档执行 **`cleanupOpenApiDoc`**（`nestjs-zod`），使 Swagger 从上述 Zod DTO **自动生成** request schema；**真源仍为 Zod schema**，勿在 Swagger 手写与 schema 冲突的 body/query。
- **遗留 Pipe**：`ZodBodyPipe` / `ZodQueryPipe` 仍保留在 `@app/http`（如单测或极少数场景）；新路由优先 DTO + 全局 pipe。
- **类型**：DTO 实例即解析后的输入，可传入 Service；Service 方法签名仍可用 `z.infer<typeof Schema>` 或领域类型，避免 `unknown` 向内扩散。
- **复用**：若 admin-web / mobile 需同源校验，将 **同一 Zod schema** 抽到 `packages/*`（如 `packages/api-schemas`）并在 `docs/design-docs/` 登记依赖关系。
- 遵循 **parse, don’t validate**：通过 schema 的解析结果作为唯一合法输入，不在 Service 内重复「猜」结构。

### 4.1 入参文档化（Zod `.describe` 与 OpenAPI）

- **强制**：凡经 **`createZodDto(schema)`** 绑定到 **`@Body()` / `@Query()`** 的 schema（含对 **`offsetPageQuerySchema.extend({...})`** 的新增字段），Zod 链上 **每个对外键** 均须 **`.describe('…')`**，用与文件其余注释 **一致的语言** 写清语义、可选性、与 querystring 的兼容约定（如布尔用字符串枚举）；**不得**依赖「仅类级 JSDoc」代替字段说明。
- **路径参数**：使用 **`@ApiParam({ name, description })`** 写清含义与格式（如 UUID）；若后续改为 Zod 解析 path，则与 body/query 相同，在 schema 上 **`.describe`**。
- **与 Swagger 的关系**：`.describe` 经 **`cleanupOpenApiDoc`** 进入 OpenAPI，与运行时校验 **同源**；新增或改名入参字段时 **同时** 更新 `.describe` 与 **第 10.2 节** 要求的 Controller **`@param`**。

---

## 5. 异常与 HTTP 响应

- 业务失败使用 **有意的异常类型**（如 `HttpException` 子类或自定义异常），由 **全局异常过滤器** 映射为规范中的 **`success: false` + `error.code` / `message` / `details`** 与正确 **HTTP 状态码**（见规范 §4.3）。
- **未捕获错误**不得向客户端泄漏堆栈或内部路径；`INTERNAL_ERROR` 对用户展示泛化文案，详情进日志。

---

## 6. 日志与可观测

- 使用 **结构化日志**（JSON 字段或键值对），至少包含 **时间、`traceId`（与 `X-Request-Id` 对齐）、模块、级别、消息**。
- 在请求进入时建立 **AsyncLocalStorage** 或 Nest 请求上下文中的 `traceId`，便于整条调用链打印同一 ID。
- 与 [`RELIABILITY.md`](RELIABILITY.md) 中的 SLO/告警规划对齐（指标与追踪接入后在本节补充链接）。

---

## 7. 安全

- **鉴权**：在 Guard 或中间件中统一校验 `Authorization`；匿名白名单路径集中配置。
- **密钥**：仅环境变量或密钥管理服务；见 [`SECURITY.md`](SECURITY.md)。
- **输入**：防注入、限流、敏感操作二次校验等按需求在技术方案中列项并实现。

---

## 8. 测试

- **单元测试**：Service 与纯函数优先；Controller 可做轻量集成测试。
- **E2E**：覆盖关键路由与健康检查；接口契约变更时更新 `*.e2e-spec.ts`。
- 合并前至少：`pnpm --filter @flasenc/server lint`、`test`；有对外 API 变更时跑 **`test:e2e`**（若适用）。

---

## 9. HTTP 共享库（`libs/http`）

- **`HttpCoreModule`**（`@app/http`）：统一 **成功信封**、**异常信封**、`X-Request-Id` / `traceId`、**`GET .../health`** 探活；`admin` / `front` 子应用 `imports: [HttpCoreModule]` 即可。
- **`DomainHttpException`**：业务可预期失败，映射为规范 §4.2。
- **`ZodBodyPipe`**：与 **§4** 一致在 Controller 边界用 Zod 解析 body，失败 **422** + `VALIDATION_FAILED`。
- **Swagger（OpenAPI）**：各子应用 `main.ts` 调用 **`setupHttpSwagger`** 后，本地开发默认启用 UI，路径 **`/docs`**（与 `setGlobalPrefix` 无关，例如 C 端 **`http://localhost:3000/docs`**、管理端 **`http://localhost:3001/docs`**）。**`NODE_ENV=production`** 时默认不挂载；需临时开启可设环境变量 **`SWAGGER_ENABLED=true`**（须由网关或网络策略限制访问面，避免对公网裸暴露）。请求体真源仍以各路由 **Zod schema** 为准，Swagger 为辅助说明。

---

## 10. 注释与逻辑同步

- **须编写注释**：对非显而易见的业务规则、事务边界、与 **`error.code` / HTTP 状态** 的映射、并发或幂等考量、与外部系统的契约，在 **Service / 领域模块** 或 **复杂 Controller 分支** 旁用简短注释或 JSDoc 说明 **「为何如此」**；避免复述方法名已表达的含义。
- **逻辑更新须同步更新注释**：行为、校验、异常路径或数据流变更时，**一并修订**相关注释；删除旧路径时 **删除或改写** 对应注释，**禁止**保留与实现不符的说明。
- **语言**：与所在文件既有风格一致；新文件默认与团队代码评审约定一致（中文或英文择一，**同一文件内不混排**）。

### 10.1 数据传输对象（DTO）与契约形状

- **Service 等层导出的 `export type …Dto` / `…Query` / `…Result`**：凡构成 **HTTP 响应体字段** 或与 **OpenAPI 示例** 应对齐的对外形状，须有 **类型级块注释**（标明 **输入 DTO / 输出 DTO / Query 别名** 等角色）；**每个字段** 须有紧邻的 **`/** … */`**，说明含义、`null` 语义、时间格式（如 ISO8601）、以及 **安全相关** 约定（如一次性明文仅响应一次、列表不含敏感字段）。
- **与 Prisma 模型注释的分工**：表/列级说明以 **`schema.prisma` 的 `///`** 为持久化真源；**HTTP 对外 DTO** 仍须在 TypeScript 侧注释 **客户端可见语义**，避免仅指向 Prisma 而不写清 API 契约。

### 10.2 Controller 与 HTTP 入参

- **每个对外路由处理方法**：在装饰器（`@Get` / `@Post` 等）与函数签名之间使用 JSDoc，以 **`@param`** 逐项说明 **`@Body()` / `@Query()` / `@Param()` / `@Req()`**（以及本方法实际用到的其它参数源）的语义与约束；**不得**仅依赖方法名或仅依赖 Swagger 注解而省略。
- **与第 4.1 节的分工**：**入参「字段含义 + OpenAPI」** 以 Zod **`.describe`** 为真源；**`@param`** 侧重 **参数源角色**（如「Owner 上下文」「分页 query」）及与 Guard 的配合；二者在契约变更时 **同步修订**。

---

## 11. 常用命令

见 [`references/repo-commands-llms.txt`](references/repo-commands-llms.txt) 中 `@flasenc/server`。

---

## 12. 流程与配置

- 研发流程见 [`development-lifecycle.md`](development-lifecycle.md)。
- **配置**：`ConfigModule` 或等价方案；禁止将生产密钥写入仓库。

---

## 13. 演进说明

当前子应用 Controller 若仍返回原始类型（如 `string`），**新开发接口**须改为符合 **`api/http-api-specification.md`** 的信封；存量接口改造纳入迭代或技术债表。
