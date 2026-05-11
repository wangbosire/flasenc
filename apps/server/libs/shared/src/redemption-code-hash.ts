import { createHash } from 'node:crypto';

/**
 * 权益兑换码入库仅存 hash；与 `docs/design-docs/content-sharing-platform-prisma-schema.md` 一致。
 * 算法：明文 UTF-8 → **SHA-256** → **小写十六进制**（管理端生成码与 C 端兑换校验须同一约定）。
 */
export function hashRedemptionCode(plainCode: string): string {
  return createHash('sha256').update(plainCode.trim(), 'utf8').digest('hex');
}
