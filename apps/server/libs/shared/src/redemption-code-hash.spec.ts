import { createHash } from 'node:crypto';
import { hashRedemptionCode } from './redemption-code-hash';

describe('hashRedemptionCode', () => {
  it('与 SHA-256 小写十六进制约定一致', () => {
    const plain = '  MY-CODE  ';
    const expected = createHash('sha256')
      .update(plain.trim(), 'utf8')
      .digest('hex');
    expect(hashRedemptionCode(plain)).toBe(expected);
  });
});
