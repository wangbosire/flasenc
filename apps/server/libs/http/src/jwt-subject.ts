/**
 * 从已通过签名校验的 JWT payload 中读取 **`sub`**（字符串），并用 **`subShape`** 做形态校验。
 *
 * **为何单独抽函数**：`jwt.verify` 只保证签名与 exp 等；`sub` 仍可能缺失或非字符串。
 * 不符合时抛 **`Error('invalid_sub')`**，由上层 `catch` 与签名失败一并映射为 **401**（避免把「坏 sub」误报成刷新过期等）。
 */
export function readJwtSubjectOrThrow(
  payloadUnknown: unknown,
  subShape: RegExp,
): string {
  const payload = payloadUnknown as { sub?: unknown };
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : undefined;
  if (!sub || !subShape.test(sub)) {
    throw new Error('invalid_sub');
  }
  return sub;
}

/** 与 `JwtService.verify` 等兼容的最小接口（便于单测 mock）。 */
type JwtVerifier = { verify: (token: string) => unknown };

/**
 * **`verify(token)`** 后立即 **`readJwtSubjectOrThrow`**。
 * 任一环节失败抛错，由调用方统一映射为会话类 **401**。
 */
export function verifyJwtReadSubjectOrThrow(
  jwt: JwtVerifier,
  token: string,
  subShape: RegExp,
): string {
  return readJwtSubjectOrThrow(jwt.verify(token), subShape);
}

/** 支持传入独立 **`secret`** 的 verify（用于 refresh 与 access 分密钥）。 */
type JwtVerifierWithOptions = {
  verify: (token: string, options?: { secret?: string }) => unknown;
};

/**
 * 使用 **`secret`** 显式校验 token（refresh 流程），再读 **`sub`**。
 * 失败由调用方映射为 **`AUTH_REFRESH_INVALID`** 等，与 access 401 文案区分。
 */
export function verifyJwtReadSubjectWithSecretOrThrow(
  jwt: JwtVerifierWithOptions,
  token: string,
  secret: string,
  subShape: RegExp,
): string {
  return readJwtSubjectOrThrow(jwt.verify(token, { secret }), subShape);
}
