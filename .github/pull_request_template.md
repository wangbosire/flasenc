## 摘要

<!-- 一句话说明本 PR 做什么 -->

## 关联需求 / 方案（Harness：须可检索）

- 需求或方案文档路径：（例如 `docs/product-specs/xxx.md` 或 Issue 链接）
- 当前研发阶段（对照 `docs/development-lifecycle.md` 序号）：（例如 8 代码开发 / 12 问题修复）

## 影响范围

- [ ] 仅 `apps/admin-web`
- [ ] 仅 `apps/mobile`
- [ ] 仅 `apps/server`
- [ ] `packages/*`（请列出包名）
- [ ] 其他（请说明）

## 自测

<!-- 列已执行的命令与结果，例如 pnpm --filter @flasenc/admin-web test -->

## 风险与回滚

<!-- 若有数据迁移、开关、兼容性问题请说明 -->

## Checklist

- [ ] 未在仓库提交密钥或真实用户数据
- [ ] 与 `ARCHITECTURE.md` / 技术方案中的边界一致（若适用）
- [ ] 若变更 HTTP API：符合 `docs/api/http-api-specification.md`（含 §7 错误码登记）
- [ ] 若改 `apps/admin-web` 或 `apps/mobile`：符合 `docs/FRONTEND.md`
- [ ] 若改 `apps/server`：符合 `docs/BACKEND.md`
