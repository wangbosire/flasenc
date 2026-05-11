import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  stripBearerToken,
  throwMemberAuthInvalidToken,
  UUID_RFC_VERSION_ANY_STRICT_REGEX,
  verifyJwtReadSubjectOrThrow,
} from '@app/http';

/** JWT `sub` 须为 **`member_users.id`**（UUID；version 位略宽，与 **`UUID_RFC_VERSION_ANY_STRICT_REGEX`** 一致）。 */
const SUB_UUID = UUID_RFC_VERSION_ANY_STRICT_REGEX;

/**
 * 无 `Authorization` 时放行（`memberId` 不设置）；带 Bearer 时须可验证，否则 401。
 * 用于「访客可读 + 登录用户可见性扩展」类路由（如公开内容 GET）。
 */
export type OptionalMemberRequest = {
  headers: { authorization?: string };
  memberId?: string;
};

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<OptionalMemberRequest>();
    const token = stripBearerToken(req.headers?.authorization);
    if (token === undefined) {
      req.memberId = undefined;
      return true;
    }
    try {
      req.memberId = verifyJwtReadSubjectOrThrow(this.jwt, token, SUB_UUID);
      return true;
    } catch {
      // 与 C 端须登录 JWT Guard 一致：显式携带 Bearer 但不可验证时拒绝，避免客户端误以为已登录态。
      throwMemberAuthInvalidToken();
    }
  }
}
