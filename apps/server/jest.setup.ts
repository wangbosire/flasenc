/**
 * 单测 / E2E 未显式设置 `DATABASE_URL` 时的本地默认（本机 MySQL，默认端口 3306）。
 * 日常开发不要求 Docker；协作/生产请用环境变量或 `.env` 覆盖，勿提交含生产口令的 `.env`。
 */
process.env.DATABASE_URL ??=
  'mysql://root:Root123..@127.0.0.1:3306/flasenc';

/** 与 `AuthModule` / E2E 一致；生产须覆盖为强随机密钥。 */
process.env.JWT_SECRET ??=
  'e2e-jwt-secret-do-not-use-in-production-min-32-chars!!';

/** 与双 token **`refresh`** 签发一致；E2E 固定值便于与 access 密钥区分。 */
process.env.JWT_REFRESH_SECRET ??=
  'e2e-jwt-refresh-secret-do-not-use-in-production-min-32!!';
