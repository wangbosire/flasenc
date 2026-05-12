/**
 * 单测 / E2E 未显式设置 `DATABASE_URL` 时的本地默认（Docker MySQL 映射端口 3307）。
 * 在 `flasenc` 容器内运行时，compose 会注入容器内连接串并覆盖该默认值。
 */
process.env.DATABASE_URL ??=
  'mysql://root:root123..@127.0.0.1:3307/flasenc';

/** 与 `AuthModule` / E2E 一致；生产须覆盖为强随机密钥。 */
process.env.JWT_SECRET ??=
  'e2e-jwt-secret-do-not-use-in-production-min-32-chars!!';

/** 与双 token **`refresh`** 签发一致；E2E 固定值便于与 access 密钥区分。 */
process.env.JWT_REFRESH_SECRET ??=
  'e2e-jwt-refresh-secret-do-not-use-in-production-min-32!!';
