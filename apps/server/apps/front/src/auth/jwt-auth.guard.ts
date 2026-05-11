import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  stripBearerToken,
  throwAuthUnauthorized,
  throwMemberAuthInvalidToken,
  UUID_V4_STRICT_REGEX,
  verifyJwtReadSubjectOrThrow,
} from '@app/http';

/** JWT `sub` 须为 **`member_users.id`**（UUID v4）。 */
const SUB_UUID = UUID_V4_STRICT_REGEX;

export type AuthedRequest = {
  headers: { authorization?: string };
  /** C 端登录主体：`MemberUser.id` */
  memberId: string;
};

/** C 端须登录路由；未带 Bearer 时 **`AUTH_UNAUTHORIZED`**（与 HTTP 规范 §7.3 一致）。 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = stripBearerToken(req.headers?.authorization);
    if (token === undefined) {
      throwAuthUnauthorized();
    }
    try {
      req.memberId = verifyJwtReadSubjectOrThrow(this.jwt, token, SUB_UUID);
      return true;
    } catch {
      throwMemberAuthInvalidToken();
    }
  }
}
