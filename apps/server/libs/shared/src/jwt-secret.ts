/**
 * C 端与管理端 **access** JWT 签名密钥（`JwtModule`）；须与 `jest.setup.ts`、`.env.example` 约定一致。
 * 生产环境务必设置强随机 `JWT_SECRET`。
 */
export function jwtSecretFromEnv(): string {
  return (
    process.env.JWT_SECRET ??
    'dev-jwt-secret-change-me-min-32-chars-for-local-only!!'
  );
}

/**
 * **refresh** JWT 须使用独立密钥；未设置时回退为 **`JWT_SECRET` + 固定派生后缀**（仅本地/E2E，生产务必显式配置 **`JWT_REFRESH_SECRET`**）。
 */
export function jwtRefreshSecretFromEnv(): string {
  return (
    process.env.JWT_REFRESH_SECRET ??
    `${jwtSecretFromEnv()}.refresh-dev-only-not-for-production`
  );
}
