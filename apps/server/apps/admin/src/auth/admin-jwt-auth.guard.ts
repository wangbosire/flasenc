import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import {
  stripBearerToken,
  throwAdminAuthRequired,
  throwAdminForbidden,
  throwMemberAuthInvalidToken,
  UUID_V4_STRICT_REGEX,
  verifyJwtReadSubjectOrThrow,
} from '@app/http';

const SUB_UUID = UUID_V4_STRICT_REGEX;

export type AdminAuthedRequest = {
  headers: { authorization?: string };
  userId: string;
};

/**
 * 管理端写路由：须有效 JWT，且对应用户 **`platformAdmin`**。
 */
@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminAuthedRequest>();
    const token = stripBearerToken(req.headers?.authorization);
    if (token === undefined) {
      throwAdminAuthRequired();
    }
    let sub: string;
    try {
      sub = verifyJwtReadSubjectOrThrow(this.jwt, token, SUB_UUID);
    } catch {
      throwMemberAuthInvalidToken();
    }

    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user) {
      throwMemberAuthInvalidToken();
    }
    if (!user.platformAdmin) {
      throwAdminForbidden();
    }

    req.userId = sub;
    return true;
  }
}
