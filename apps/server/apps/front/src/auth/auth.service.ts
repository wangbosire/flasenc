import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  assertMemberUserRowExists,
  AuditAction,
  AuditLogService,
  PrismaService,
} from '@app/database';
import {
  DomainHttpException,
  JWT_ACCESS_TTL_SECONDS,
  JWT_REFRESH_TTL_SECONDS,
  throwAuthInvalidCredentials,
  throwAuthRefreshInvalid,
  throwMemberAuthInvalidToken,
  UUID_V4_STRICT_REGEX,
  verifyJwtReadSubjectWithSecretOrThrow,
} from '@app/http';
import {
  jwtRefreshSecretFromEnv,
  wechatMiniProgramCode2Session,
} from '@app/shared';

const BCRYPT_ROUNDS = 10;

function loginAttemptTargetId(
  prefix: 'member' | 'admin',
  email: string,
): string {
  return createHash('sha256')
    .update(`${prefix}:${email.toLowerCase()}`)
    .digest('hex');
}

/** 与 {@link AuditAction.MEMBER_REGISTER_FAILURE} 的 `targetId` 规则一致；供测试断言。 */
export function memberRegisterFailureTargetId(email: string): string {
  return createHash('sha256')
    .update(`member:register:${email.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * **输出 DTO**：会员登录或刷新成功后的双 token 载荷（与 HTTP 规范及管理端 `AdminAuthTokenPairDto` 字段对称，主体 id 名为 `memberId`）。
 */
export type MemberAuthTokenPairDto = {
  /** 访问 JWT（`Authorization: Bearer`）。 */
  accessToken: string;
  /** 刷新 JWT（换取新 access/refresh）。 */
  refreshToken: string;
  /** 固定为 `Bearer`，与 OAuth 系资源访问约定对齐。 */
  tokenType: 'Bearer';
  /** `accessToken` 剩余有效秒数（与签发 TTL 一致）。 */
  expiresInSeconds: number;
  /** `refreshToken` 剩余有效秒数。 */
  refreshExpiresInSeconds: number;
  /** 当前会员主体：`MemberUser.id`（与 JWT `sub` 对应）。 */
  memberId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
  ) {}

  private appendMemberLoginFailure(
    email: string,
    reason: 'user_not_found' | 'bad_password',
  ): Promise<void> {
    return this.auditLog.append(this.prisma, {
      actorMemberId: null,
      action: AuditAction.MEMBER_LOGIN_FAILURE,
      targetType: 'LoginAttempt',
      targetId: loginAttemptTargetId('member', email),
      payload: { reason },
    });
  }

  /** 签发 access + refresh；**`refresh`** 使用独立密钥（见 **`jwtRefreshSecretFromEnv`**）。 */
  private async createMemberAccessRefreshPair(memberId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    refreshExpiresInSeconds: number;
  }> {
    const accessToken = await this.jwt.signAsync(
      { jti: randomUUID() },
      { subject: memberId, expiresIn: JWT_ACCESS_TTL_SECONDS },
    );
    const refreshToken = await this.jwt.signAsync(
      { jti: randomUUID() },
      {
        secret: jwtRefreshSecretFromEnv(),
        subject: memberId,
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

  async register(params: {
    email: string;
    password: string;
  }): Promise<{ memberId: string; email: string; displayName: string | null }> {
    const email = params.email.trim().toLowerCase();
    const passwordHash = bcrypt.hashSync(params.password, BCRYPT_ROUNDS);
    try {
      const out = await this.prisma.$transaction(async (tx) => {
        const member = await tx.memberUser.create({
          data: {
            email,
            passwordHash,
          },
        });
        await this.auditLog.append(tx, {
          actorMemberId: member.id,
          action: AuditAction.MEMBER_REGISTER,
          targetType: 'MemberUser',
          targetId: member.id,
          payload: {},
        });
        return {
          memberId: member.id,
          email: member.email ?? email,
          displayName: member.displayName ?? null,
        };
      });
      return out;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        await this.auditLog.append(this.prisma, {
          actorMemberId: null,
          action: AuditAction.MEMBER_REGISTER_FAILURE,
          targetType: 'RegisterAttempt',
          targetId: memberRegisterFailureTargetId(email),
          payload: { reason: 'email_taken', errorCode: 'AUTH_EMAIL_TAKEN' },
        });
        throw new DomainHttpException(
          409,
          'AUTH_EMAIL_TAKEN',
          '该邮箱已被注册',
          { field: 'email' },
        );
      }
      throw e;
    }
  }

  /** 当前登录会员摘要；库中无行时与无效 JWT 一致返回 **401**。 */
  async getMe(memberId: string): Promise<{
    memberId: string;
    email: string;
    displayName: string | null;
  }> {
    const member = await this.prisma.memberUser.findUnique({
      where: { id: memberId },
      select: { id: true, email: true, displayName: true },
    });
    if (!member) {
      throwMemberAuthInvalidToken();
    }
    return {
      memberId: member.id,
      /** 纯微信账号可无邮箱；客户端以空串表示未绑定。 */
      email: member.email ?? '',
      displayName: member.displayName ?? null,
    };
  }

  /**
   * 更新资料与/或登录密码：改密须 **`currentPassword`** + **`newPassword`** 成对出现；
   * **`displayName`** 可单独提交（含 **`null`** 清空）；与密码变更可同事务执行。
   */
  async patchMe(
    memberId: string,
    body: {
      currentPassword?: string;
      newPassword?: string;
      displayName?: string | null;
    },
  ): Promise<{
    memberId: string;
    email: string;
    displayName: string | null;
  }> {
    const member = await this.prisma.memberUser.findUnique({
      where: { id: memberId },
    });
    if (!member) {
      throwMemberAuthInvalidToken();
    }

    const wantsPassword =
      body.currentPassword !== undefined && body.newPassword !== undefined;
    let newPasswordPlain: string | undefined;
    if (wantsPassword) {
      if (!member.passwordHash) {
        throw new DomainHttpException(
          400,
          'AUTH_PASSWORD_NOT_SET',
          '当前账号未设置登录密码，无法在此修改密码',
          {},
        );
      }
      const currentPassword = body.currentPassword!;
      newPasswordPlain = body.newPassword!;
      if (!bcrypt.compareSync(currentPassword, member.passwordHash)) {
        throw new DomainHttpException(
          400,
          'AUTH_CURRENT_PASSWORD_INVALID',
          '当前密码不正确',
          {},
        );
      }
      if (bcrypt.compareSync(newPasswordPlain, member.passwordHash)) {
        throw new DomainHttpException(
          400,
          'AUTH_NEW_PASSWORD_REUSE',
          '新密码不能与当前密码相同',
          {},
        );
      }
    }

    const wantsProfile = body.displayName !== undefined;
    const nextDisplay = wantsProfile
      ? body.displayName === null
        ? null
        : body.displayName!.trim() === ''
          ? null
          : body.displayName!.trim()
      : undefined;

    const displayChanged =
      wantsProfile && (member.displayName ?? null) !== (nextDisplay ?? null);

    const data: Prisma.MemberUserUpdateInput = {};
    if (wantsPassword && newPasswordPlain !== undefined) {
      data.passwordHash = bcrypt.hashSync(newPasswordPlain, BCRYPT_ROUNDS);
    }
    if (displayChanged) {
      data.displayName = nextDisplay!;
    }

    if (Object.keys(data).length === 0) {
      return this.getMe(memberId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.memberUser.update({
        where: { id: memberId },
        data,
      });
      if (displayChanged) {
        await this.auditLog.append(tx, {
          actorMemberId: memberId,
          action: AuditAction.MEMBER_PROFILE_UPDATE,
          targetType: 'MemberUser',
          targetId: memberId,
          payload: { displayName: nextDisplay ?? null },
        });
      }
      if (wantsPassword) {
        await this.auditLog.append(tx, {
          actorMemberId: memberId,
          action: AuditAction.MEMBER_PASSWORD_CHANGE,
          targetType: 'MemberUser',
          targetId: memberId,
          payload: {},
        });
      }
    });

    return this.getMe(memberId);
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<MemberAuthTokenPairDto> {
    const email = params.email.trim().toLowerCase();
    const member = await this.prisma.memberUser.findUnique({
      where: { email },
    });
    if (!member?.passwordHash) {
      await this.appendMemberLoginFailure(email, 'user_not_found');
      throwAuthInvalidCredentials();
    }
    const ok = bcrypt.compareSync(params.password, member.passwordHash);
    if (!ok) {
      await this.appendMemberLoginFailure(email, 'bad_password');
      throwAuthInvalidCredentials();
    }
    const tokens = await this.createMemberAccessRefreshPair(member.id);
    await this.auditLog.append(this.prisma, {
      actorMemberId: member.id,
      action: AuditAction.MEMBER_LOGIN_SUCCESS,
      targetType: 'MemberUser',
      targetId: member.id,
      payload: {},
    });
    return {
      ...tokens,
      tokenType: 'Bearer',
      memberId: member.id,
    };
  }

  /**
   * 微信小程序 **`uni.login`** 换 **`openid`** 后签发与邮箱登录相同的双 token；
   * 首次登录自动建 **`MemberUser`**（可无邮箱），并写 **`MEMBER_REGISTER`** 审计 **`via: wechat_mp`**。
   */
  async loginWeChatMiniProgram(params: {
    code: string;
  }): Promise<MemberAuthTokenPairDto> {
    const code = params.code.trim();
    if (code.length < 6) {
      throw new DomainHttpException(422, 'VALIDATION_FAILED', 'code 无效', {
        field: 'code',
      });
    }

    const wx = await wechatMiniProgramCode2Session(code);
    if (!wx.ok) {
      if (wx.errcode === -1) {
        throw new DomainHttpException(
          503,
          'AUTH_WECHAT_MINI_PROGRAM_NOT_CONFIGURED',
          '小程序微信登录未配置',
          {},
        );
      }
      if (wx.errcode < 0) {
        throw new DomainHttpException(
          502,
          'AUTH_WECHAT_UPSTREAM_ERROR',
          '微信服务暂不可用',
          {},
        );
      }
      /** 常见：**`code`** 过期或已使用（微信 **`errcode`** **`40029`** / **`40163`**）。 */
      const invalidJsCode = new Set([40029, 40163]);
      if (invalidJsCode.has(wx.errcode)) {
        throw new DomainHttpException(
          400,
          'AUTH_WECHAT_CODE_INVALID',
          '登录凭证无效或已过期，请重试',
          {},
        );
      }
      throw new DomainHttpException(
        502,
        'AUTH_WECHAT_UPSTREAM_ERROR',
        '微信服务返回错误',
        { errcode: wx.errcode },
      );
    }

    const { openid, unionid } = wx;

    const member = await this.prisma.$transaction(async (tx) => {
      const m = await this.findMemberUserByWechat(tx, openid, unionid);
      if (m) {
        await this.syncWechatIdsOnMember(tx, m.id, openid, unionid);
        return m;
      }
      try {
        const created = await tx.memberUser.create({
          data: {
            wechatMpOpenId: openid,
            ...(unionid ? { wechatUnionId: unionid } : {}),
          },
        });
        await this.auditLog.append(tx, {
          actorMemberId: created.id,
          action: AuditAction.MEMBER_REGISTER,
          targetType: 'MemberUser',
          targetId: created.id,
          payload: { via: 'wechat_mp' },
        });
        return created;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const retry = await this.findMemberUserByWechat(tx, openid, unionid);
          if (!retry) {
            throw e;
          }
          await this.syncWechatIdsOnMember(tx, retry.id, openid, unionid);
          return retry;
        }
        throw e;
      }
    });

    const tokens = await this.createMemberAccessRefreshPair(member.id);
    await this.auditLog.append(this.prisma, {
      actorMemberId: member.id,
      action: AuditAction.MEMBER_LOGIN_SUCCESS,
      targetType: 'MemberUser',
      targetId: member.id,
      payload: { via: 'wechat_mp' },
    });
    return {
      ...tokens,
      tokenType: 'Bearer',
      memberId: member.id,
    };
  }

  private async findMemberUserByWechat(
    tx: Prisma.TransactionClient,
    openid: string,
    unionid: string | null,
  ) {
    if (unionid) {
      const byUnion = await tx.memberUser.findFirst({
        where: { wechatUnionId: unionid },
      });
      if (byUnion) {
        return byUnion;
      }
    }
    return tx.memberUser.findUnique({
      where: { wechatMpOpenId: openid },
    });
  }

  /** 将当前会话的 **`openid`** / **`unionid`** 写回账号行（例如 **`unionid`** 后开通或换绑场景）。 */
  private async syncWechatIdsOnMember(
    tx: Prisma.TransactionClient,
    memberId: string,
    openid: string,
    unionid: string | null,
  ): Promise<void> {
    const row = await tx.memberUser.findUnique({
      where: { id: memberId },
      select: { wechatMpOpenId: true, wechatUnionId: true },
    });
    if (!row) {
      return;
    }
    const data: Prisma.MemberUserUpdateInput = {};
    if (row.wechatMpOpenId !== openid) {
      data.wechatMpOpenId = openid;
    }
    if (unionid && row.wechatUnionId !== unionid) {
      data.wechatUnionId = unionid;
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    await tx.memberUser.update({ where: { id: memberId }, data });
  }

  /**
   * 使用 **`refreshToken`** 轮换一对新 JWT；**`sub`** 须为仍存在的 **`MemberUser.id`**。
   * 改密后旧 refresh 在过期前仍可能有效（未做服务端吊销表；客户端应在改密成功后丢弃本地 refresh）。
   */
  async refresh(params: {
    refreshToken: string;
  }): Promise<MemberAuthTokenPairDto> {
    const raw = params.refreshToken?.trim();
    if (!raw) {
      throwAuthRefreshInvalid();
    }
    let memberId: string;
    try {
      memberId = verifyJwtReadSubjectWithSecretOrThrow(
        this.jwt,
        raw,
        jwtRefreshSecretFromEnv(),
        UUID_V4_STRICT_REGEX,
      );
    } catch {
      throwAuthRefreshInvalid();
    }
    await assertMemberUserRowExists(this.prisma, memberId);
    const tokens = await this.createMemberAccessRefreshPair(memberId);
    await this.auditLog.append(this.prisma, {
      actorMemberId: memberId,
      action: AuditAction.MEMBER_AUTH_REFRESH,
      targetType: 'MemberUser',
      targetId: memberId,
      payload: {},
    });
    return {
      ...tokens,
      tokenType: 'Bearer',
      memberId,
    };
  }
}
