# 设计原则

与 **Harness** 一致：实现应可从仓库推断；重复评审结论应落到文档或自动化。

1. 边界处解析数据形状；内部使用明确类型。**后端 HTTP 入参**以 **Zod** 在 Controller 边界 parse（见 [`BACKEND.md`](BACKEND.md) §4）。  
2. 模块边界清晰；横切经统一入口。  
3. 可测、可观测；关键路径有日志或指标（见 `RELIABILITY.md`）。  
4. 重大取舍写入 `design-docs/` 或技术方案。  
5. **注释**：非显而易见的意图、分支与契约须在代码旁说明；**逻辑变更时同步更新注释**，避免过时或误导（细则见 [`FRONTEND.md`](FRONTEND.md) **§1.5**、[`BACKEND.md`](BACKEND.md) **§10**）。

需求与验收口径见 `product-specs/` 与 [`development-lifecycle.md`](development-lifecycle.md)。

前后端 **HTTP JSON** 传输与错误体约定见 [`api/http-api-specification.md`](api/http-api-specification.md)。  
实现侧细则见 [`FRONTEND.md`](FRONTEND.md)（Web/移动端）与 [`BACKEND.md`](BACKEND.md)（Nest）。
