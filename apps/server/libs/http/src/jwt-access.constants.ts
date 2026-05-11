/**
 * C 端 / 管理端 **access** JWT 有效期（秒）：**15 分钟**。
 * 与 `JwtModule.register` 的 `expiresIn` 及客户端刷新策略对齐；过短易打断用户，过长降低盗用 token 的风险窗口权衡在此取值。
 */
export const JWT_ACCESS_TTL_SECONDS = 15 * 60;

/**
 * **refresh** JWT 有效期（秒）：**30 天**。
 * 用于「长期记住登录」与轮换 refresh；须使用独立 **`JWT_REFRESH_SECRET`** 签发。
 */
export const JWT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
