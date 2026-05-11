import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { AuditAction, AuditLogService, PrismaService } from '@app/database';
import {
  JWT_ACCESS_TTL_SECONDS,
  JWT_REFRESH_TTL_SECONDS,
  throwAuthInvalidCredentials,
  throwAuthRefreshInvalid,
  UUID_V4_STRICT_REGEX,
  verifyJwtReadSubjectWithSecretOrThrow,
} from '@app/http';
import { jwtRefreshSecretFromEnv } from '@app/shared';

function adminLoginAttemptTargetId(email: string): string {
  return createHash('sha256')
    .update(`admin:${email.toLowerCase()}`)
    .digest('hex');
}

/**
 * **输出 DTO**：管理端登录或刷新成功后的双 token 载荷；主体为平台用户 **`userId`**（`users.id`）。
 */
export type AdminAuthTokenPairDto = {
  /** 管理端访问 JWT。 */
  accessToken: string;
  /** 管理端刷新 JWT。 */
  refreshToken: string;
  /** 固定为 `Bearer`。 */
  tokenType: 'Bearer';
  /** `accessToken` 剩余有效秒数。 */
  expiresInSeconds: number;
  /** `refreshToken` 剩余有效秒数。 */
  refreshExpiresInSeconds: number;
  /** 平台用户 id：`users.id`。 */
  userId: string;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
  ) {}

  private appendAdminLoginFailure(
    email: string,
    reason: 'user_not_found' | 'bad_password' | 'not_platform_admin',
  ): Promise<void> {
    return this.auditLog.append(this.prisma, {
      actorUserId: null,
      action: AuditAction.ADMIN_LOGIN_FAILURE,
      targetType: 'LoginAttempt',
      targetId: adminLoginAttemptTargetId(email),
      payload: { reason },
    });
  }

  private async createAdminAccessRefreshPair(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    refreshExpiresInSeconds: number;
  }> {
    const accessToken = await this.jwt.signAsync(
      { jti: randomUUID() },
      { subject: userId, expiresIn: JWT_ACCESS_TTL_SECONDS },
    );
    const refreshToken = await this.jwt.signAsync(
      { jti: randomUUID() },
      {
        secret: jwtRefreshSecretFromEnv(),
        subject: userId,
        expiresIn: JWT_REFRESH_TTL_SECONDS,
      },
    );
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: JWT_ACCESS_TTL_SECONDS,
      refreshExpiresInSeconds: JWT_REFRESH_TTL_SECONDS,
    };
  }

  /**
   * 仅 **`platformAdmin`** 用户可换取管理端 JWT（**access** 与 **refresh** 分密钥，与 C 端 **`jwtSecretFromEnv`** / **`jwtRefreshSecretFromEnv`** 对齐）。
   * 非管理员或凭据错误统一 **401**，避免枚举平台账号。
   */
  async login(params: {
    email: string;
    password: string;
  }): Promise<AdminAuthTokenPairDto> {
    const email = params.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      await this.appendAdminLoginFailure(email, 'user_not_found');
      throwAuthInvalidCredentials();
    }
    if (!bcrypt.compareSync(params.password, user.passwordHash)) {
      await this.appendAdminLoginFailure(email, 'bad_password');
      throwAuthInvalidCredentials();
    }
    if (!user.platformAdmin) {
      await this.appendAdminLoginFailure(email, 'not_platform_admin');
      throwAuthInvalidCredentials();
    }

    const tokens = await this.createAdminAccessRefreshPair(user.id);
    await this.auditLog.append(this.prisma, {
      actorUserId: user.id,
      action: AuditAction.ADMIN_LOGIN_SUCCESS,
      targetType: 'User',
      targetId: user.id,
      payload: {},
    });
    return {
      ...tokens,
      tokenType: 'Bearer',
      userId: user.id,
    };
  }

  /**
   * 管理端 **`refreshToken`** 轮换；**`sub`** 须对应仍存在且 **`platformAdmin`** 的 **`User`**。
   */
  async refresh(params: {
    refreshToken: string;
  }): Promise<AdminAuthTokenPairDto> {
    const raw = params.refreshToken?.trim();
    if (!raw) {
      throwAuthRefreshInvalid();
    }
    let userId: string;
    try {
      userId = verifyJwtReadSubjectWithSecretOrThrow(
        this.jwt,
        raw,
        jwtRefreshSecretFromEnv(),
        UUID_V4_STRICT_REGEX,
      );
    } catch {
      throwAuthRefreshInvalid();
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.platformAdmin) {
      throwAuthRefreshInvalid();
    }
    const tokens = await this.createAdminAccessRefreshPair(userId);
    await this.auditLog.append(this.prisma, {
      actorUserId: userId,
      action: AuditAction.ADMIN_AUTH_REFRESH,
      targetType: 'User',
      targetId: userId,
      payload: {},
    });
    return {
      ...tokens,
      tokenType: 'Bearer',
      userId,
    };
  }
}
