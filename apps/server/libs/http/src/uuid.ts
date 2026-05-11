import { DomainHttpException } from './domain-http.exception';

/**
 * 严格 **UUID v4** 形态（RFC 4122）：`version` 位为 **4**，`variant` 位为 **8/9/a/b**。
 * 用于 JWT `sub`、审计筛选等须与签发策略一致的 id。
 */
export const UUID_V4_STRICT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * RFC `version` 位允许 **1–5**（略宽于仅 v4），用于兼容历史数据或可选 JWT 场景。
 */
export const UUID_RFC_VERSION_ANY_STRICT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 与 Prisma **`@db.Char(36)`** 存库形态一致：**36** 位十六进制 + 连字符，**不校验 version 位**。
 * 内容/评论等表主键若均用该形态，可用本正则做宽松校验。
 */
export const UUID_CHAR36_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 判断字符串是否为 **Char(36)** UUID 形态（不保证 v4）。 */
export function isUuidChar36(id: string): boolean {
  return UUID_CHAR36_REGEX.test(id);
}

/**
 * 将「明显非法的路径参数 id」直接转为 **404 `NOT_FOUND`**，与「资源不存在/无权见」对外统一策略一致。
 *
 * **不适用**：需要返回 **400** 业务码的场景（例如评论锚点非法），应在校验层抛 {@link DomainHttpException}(400, ...)。
 */
export function assertUuidShapeOrNotFound(
  id: string,
  notFoundMessage: string,
): void {
  if (!isUuidChar36(id)) {
    throw new DomainHttpException(404, 'NOT_FOUND', notFoundMessage, {});
  }
}
