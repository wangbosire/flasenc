# 可靠性

与全流程 **技术方案、上线、上线后验证** 对齐（[`development-lifecycle.md`](development-lifecycle.md) §3）。

## 发布与线上验证

- **发版检查清单（模板）**：[ **`runbook/release-checklist.md`**](runbook/release-checklist.md) — 每次发版复制填写，作为记录系统的一部分。  
- **Runbook 目录索引**：[ **`runbook/README.md`**](runbook/README.md)。

## SLO 与容量（占位）

| 服务 / 入口 | 目标（示例列） | 当前文档 / 看板 |
|-------------|----------------|-----------------|
| （待填）例如 API P99 延迟 | 例如：P99 低于 500ms | 在此处贴 Grafana / 云监控 URL |
| 错误率 | 例如：5xx 低于 0.1% | |

维护者将上表替换为真实服务名，并粘贴 **可点击的监控 / 日志查询** 链接（勿放密钥）。

## 超时、重试与降级（占位）

- 对外 HTTP 客户端超时默认值：（待与 `FRONTEND.md` 实现统一后填写）  
- 幂等与重试：见 [`api/http-api-specification.md`](api/http-api-specification.md) §6。  
- 降级策略：（按业务在 `product-specs` 或技术方案中定义后，在此链一行摘要）

## 告警与 on-call（占位）

- 告警路由：（待填：PagerDuty / 企业微信 / 邮件等）  
- 主值班入口：（链接）

## 与可观测实现

- 后端结构化日志与 `traceId` 见 [`BACKEND.md`](BACKEND.md) §6。  
- 指标与追踪接入后，在本节 **SLO 表** 增加列「指标名 / PromQL 或等价」。
