import { z } from 'zod';
import { UUID_CHAR36_REGEX, UUID_V4_STRICT_REGEX } from './uuid';

/**
 * Zod 字符串：**Char(36)** UUID 形态（与 **`isUuidChar36`** 一致）。
 * 比内置 **`z.string().uuid()`** 略宽，与当前 Prisma 主键字符串形态对齐。
 */
export const zUuidChar36 = (message = '须为有效 ID') =>
  z.string().regex(UUID_CHAR36_REGEX, message);

/** 可选：未传则跳过；传了则须满足 **`zUuidChar36`**。 */
export const zUuidChar36Optional = (message = '须为有效 ID') =>
  zUuidChar36(message).optional();

/** 严格 **UUID v4**（与 **`UUID_V4_STRICT_REGEX`** 一致），用于审计 query 等。 */
export const zUuidV4Strict = (message = '须为 UUID') =>
  z.string().regex(UUID_V4_STRICT_REGEX, message);
