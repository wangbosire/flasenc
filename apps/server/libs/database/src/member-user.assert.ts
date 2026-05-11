import type { PrismaClient } from '@prisma/client';
import { throwMemberAuthInvalidToken } from '@app/http';

type MemberUserDb = Pick<PrismaClient, 'memberUser'>;

/**
 * 写路径等：仅校验 **`member_users`** 行存在（`email` 可空，与历史 **`ensureMemberExists`** 语义一致）。
 */
export async function assertMemberUserRowExists(
  db: MemberUserDb,
  memberId: string,
): Promise<void> {
  const member = await db.memberUser.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) {
    throwMemberAuthInvalidToken();
  }
}

/**
 * 依赖「已建立登录态」的能力（通知、偏好等）：须存在且 **`email` 非空**（与历史 **`assertMemberSession`** 一致）。
 */
export async function assertMemberUserEmailPresent(
  db: MemberUserDb,
  memberId: string,
): Promise<void> {
  const member = await db.memberUser.findUnique({
    where: { id: memberId },
    select: { id: true, email: true },
  });
  if (!member?.email) {
    throwMemberAuthInvalidToken();
  }
}
