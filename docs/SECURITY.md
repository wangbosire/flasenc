# 安全

- 禁止在仓库存放密钥与长期令牌；使用环境变量名或密钥管理系统。  
- 敏感需求在 **需求评审 / 技术方案评审** 中纳入安全角色（见 [`development-lifecycle.md`](development-lifecycle.md)）。  
- 依赖升级关注 CVE。  
- **审计日志**：业务若要求「全量操作留痕」（见 [`product-specs/content-sharing-platform.md`](product-specs/content-sharing-platform.md) §13），须约定**存储防篡改**、**保留周期**、**PII 脱敏**与访问控制，并在技术方案中实现。
