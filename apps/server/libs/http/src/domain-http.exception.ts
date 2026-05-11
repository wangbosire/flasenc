/**
 * 领域 / HTTP 层「可预期失败」异常：携带 **HTTP 状态**、**业务 error.code**、**details** 载荷。
 * 由 {@link ApiExceptionFilter} 捕获后写入规范失败信封；**不要**对这类错误打印未处理堆栈噪音（应在抛出点已记录足够上下文）。
 */
export class DomainHttpException extends Error {
  /**
   * @param status HTTP 状态码（如 400/401/404/409/422）
   * @param errorCode 与 `docs/api/http-api-specification.md` 对齐的字符串码
   * @param message 面向调用方/终端用户的简短说明
   * @param details 结构化补充信息（如校验 `fields`、业务 reason）；默认可 `{}`
   */
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainHttpException';
  }
}

/**
 * C 端 access JWT：`sub` 非法或会员行缺失等，与 **`JwtAuthGuard`**、数据库断言统一为 **401**。
 */
export function throwMemberAuthInvalidToken(): never {
  throw new DomainHttpException(
    401,
    'AUTH_INVALID_TOKEN',
    '登录状态无效，请重新登录',
    {},
  );
}

/** 须登录路由未带 `Authorization: Bearer` 或 token 为空。 */
export function throwAuthUnauthorized(): never {
  throw new DomainHttpException(401, 'AUTH_UNAUTHORIZED', '请先登录', {});
}

/** 管理端须登录路由未带 Bearer。 */
export function throwAdminAuthRequired(): never {
  throw new DomainHttpException(
    401,
    'ADMIN_AUTH_REQUIRED',
    '请先登录管理端',
    {},
  );
}

/**
 * 登录邮箱密码不匹配：**401** + 泛化文案，**避免**通过不同错误信息枚举有效账号。
 */
export function throwAuthInvalidCredentials(): never {
  throw new DomainHttpException(
    401,
    'AUTH_INVALID_CREDENTIALS',
    '邮箱或密码错误',
    {},
  );
}

/** refresh JWT 校验失败：过期、签名错误、`sub` 形态不对等。 */
export function throwAuthRefreshInvalid(): never {
  throw new DomainHttpException(
    401,
    'AUTH_REFRESH_INVALID',
    '刷新令牌无效或已过期',
    {},
  );
}

/** 管理端 JWT 有效但 **`User.platformAdmin !== true`**。 */
export function throwAdminForbidden(): never {
  throw new DomainHttpException(
    403,
    'ADMIN_FORBIDDEN',
    '需要平台管理员权限',
    {},
  );
}
