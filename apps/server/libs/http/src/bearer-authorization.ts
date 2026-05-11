/**
 * 解析标准 **`Authorization: Bearer <token>`** 头。
 *
 * **返回 `undefined` 的情况**：头缺失、不以 `bearer ` 开头（大小写不敏感）、`Bearer` 后无有效非空 token。
 * Guard 将 `undefined` 视为未登录或格式错误，与产品「须登录」语义一致。
 */
export function stripBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (
    !authorization?.toLowerCase().startsWith('bearer ') ||
    authorization.length < 'Bearer '.length + 2
  ) {
    return undefined;
  }
  const t = authorization.slice('Bearer '.length).trim();
  return t.length > 0 ? t : undefined;
}
