import { createHash } from 'node:crypto';

/**
 * 兑换码 **单向摘要**（非对称加密、不可逆）：用于 `code_hash` 唯一约束，以及在 **`plain_code` 未落库的旧数据** 上仍可按用户输入兑换。
 * 新发码同事务写入明文列；兑换路径优先命中 **`plain_code` 精确匹配**，缺失时再回落本哈希查找。
 * 算法：明文 UTF-8 trim → **SHA-256** → **小写十六进制**。
 */
export function hashRedemptionCode(plainCode: string): string {
  return createHash('sha256').update(plainCode.trim(), 'utf8').digest('hex');
}
