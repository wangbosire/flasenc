import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Response } from 'supertest';
import { AuditAction, PrismaService } from '@app/database';
import { hashRedemptionCode } from '@app/shared';
import { JWT_ACCESS_TTL_SECONDS } from '@app/http';
import {
  memberRegisterFailureTargetId,
  type MemberAuthTokenPairDto,
} from './../src/auth/auth.service';
import { InAppNotificationCategory } from './../src/in-app-notifications/in-app-notification-categories';
import { ContentModerationProcessorService } from './../src/moderation/content-moderation-processor.service';
import { TransferExpiryProcessorService } from './../src/transfers/transfer-expiry-processor.service';
import { FrontModule } from './../src/front.module';

type ApiSuccess<T> = { success: true; data: T; traceId: string };
type ApiFailure = {
  success: false;
  error: { code: string; message: string; details: unknown };
  traceId: string;
};

describe('Front API (e2e)', () => {
  let app: INestApplication;

  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FrontModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health 返回信封', () => {
    return request(server())
      .get('/api/v1/health')
      .expect(200)
      .expect((res: Response) => {
        const body = res.body as ApiSuccess<{ ok: true }>;
        expect(body.success).toBe(true);
        expect(body.data.ok).toBe(true);
        expect(body.traceId).toBeDefined();
      });
  });

  it('POST /api/v1/auth/register 201 并返回 memberId', async () => {
    const email = `e2e-reg-${randomUUID()}@x.test`;
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'E2ePass11!!' })
      .expect(201);
    const body = res.body as ApiSuccess<{
      memberId: string;
      email: string;
      displayName: string | null;
    }>;
    expect(body.data.email).toBe(email);
    expect(body.data.displayName).toBeNull();
    const prisma = app.get(PrismaService);
    await prisma.memberUser.delete({ where: { id: body.data.memberId } });
  });

  it('POST /api/v1/auth/register 重复邮箱 409 并写注册失败审计', async () => {
    const email = `e2e-dup-${randomUUID()}@x.test`;
    const prisma = app.get(PrismaService);
    const targetId = memberRegisterFailureTargetId(email);
    try {
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password: 'E2ePass11!!' })
        .expect(201);
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password: 'E2ePass11!!' })
        .expect(409)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_EMAIL_TAKEN');
        });
      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.MEMBER_REGISTER_FAILURE,
          targetId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();
      expect(aud!.targetType).toBe('RegisterAttempt');
      expect(aud!.payload).toEqual(
        expect.objectContaining({
          reason: 'email_taken',
          errorCode: 'AUTH_EMAIL_TAKEN',
        }),
      );
    } finally {
      await prisma.auditLog.deleteMany({ where: { targetId } });
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('GET /api/v1/auth/me 无 Authorization 返回 401', () => {
    return request(server())
      .get('/api/v1/auth/me')
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
      });
  });

  it('POST /api/v1/auth/refresh 轮换双 token 并可访问 me', async () => {
    const email = `e2e-refresh-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    try {
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const loginData = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data;
      expect(loginData.refreshToken.length).toBeGreaterThan(10);
      expect(loginData.refreshExpiresInSeconds).toBe(30 * 24 * 60 * 60);

      const refreshed = await request(server())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginData.refreshToken })
        .expect(200);
      const r = (refreshed.body as ApiSuccess<MemberAuthTokenPairDto>).data;
      expect(r.accessToken).not.toBe(loginData.accessToken);
      expect(r.refreshToken).not.toBe(loginData.refreshToken);
      expect(r.memberId).toBe(loginData.memberId);

      await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${r.accessToken}`)
        .expect(200);

      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.MEMBER_AUTH_REFRESH,
          targetId: loginData.memberId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();
    } finally {
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('POST /api/v1/auth/refresh 非法 refreshToken 401 AUTH_REFRESH_INVALID', () => {
    return request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-jwt-at-all' })
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('AUTH_REFRESH_INVALID');
      });
  });

  it('POST /api/v1/auth/wechat/mini-program 未配置微信密钥时 503', async () => {
    const hadApp = process.env.WECHAT_MINI_PROGRAM_APPID;
    const hadSecret = process.env.WECHAT_MINI_PROGRAM_SECRET;
    delete process.env.WECHAT_MINI_PROGRAM_APPID;
    delete process.env.WECHAT_MINI_PROGRAM_SECRET;
    try {
      await request(server())
        .post('/api/v1/auth/wechat/mini-program')
        .send({ code: 'e2e-placeholder-code-123456' })
        .expect(503)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe(
            'AUTH_WECHAT_MINI_PROGRAM_NOT_CONFIGURED',
          );
        });
    } finally {
      if (hadApp !== undefined) {
        process.env.WECHAT_MINI_PROGRAM_APPID = hadApp;
      } else {
        delete process.env.WECHAT_MINI_PROGRAM_APPID;
      }
      if (hadSecret !== undefined) {
        process.env.WECHAT_MINI_PROGRAM_SECRET = hadSecret;
      } else {
        delete process.env.WECHAT_MINI_PROGRAM_SECRET;
      }
    }
  });

  it('GET /api/v1/auth/me 带 Token 返回 memberId 与 email', async () => {
    const email = `e2e-me-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    try {
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res: Response) => {
          const body = res.body as ApiSuccess<{
            memberId: string;
            email: string;
            displayName: string | null;
          }>;
          expect(body.data.memberId).toBe(memberId);
          expect(body.data.email).toBe(email.toLowerCase());
          expect(body.data.displayName).toBeNull();
        });
    } finally {
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('GET /api/v1/auth/me 纯微信账号 email 为空串', async () => {
    const prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const openid = `e2eox${randomUUID().replace(/-/g, '')}`.slice(0, 64);
    let memberId: string | undefined;
    try {
      const member = await prisma.memberUser.create({
        data: { wechatMpOpenId: openid },
      });
      memberId = member.id;
      const accessToken = await jwt.signAsync(
        { jti: randomUUID() },
        { subject: member.id, expiresIn: JWT_ACCESS_TTL_SECONDS },
      );
      await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: Response) => {
          const body = res.body as ApiSuccess<{
            memberId: string;
            email: string;
          }>;
          expect(body.data.memberId).toBe(member.id);
          expect(body.data.email).toBe('');
        });
    } finally {
      if (memberId) {
        await prisma.memberUser.delete({ where: { id: memberId } });
      }
    }
  });

  it('PATCH /api/v1/auth/me 无密码账号提交改密 400 AUTH_PASSWORD_NOT_SET', async () => {
    const prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const openid = `e2enp${randomUUID().replace(/-/g, '')}`.slice(0, 64);
    let memberId: string | undefined;
    try {
      const member = await prisma.memberUser.create({
        data: { wechatMpOpenId: openid },
      });
      memberId = member.id;
      const accessToken = await jwt.signAsync(
        { jti: randomUUID() },
        { subject: member.id, expiresIn: JWT_ACCESS_TTL_SECONDS },
      );
      await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'AnyOld1!!',
          newPassword: 'NewPass11!!',
        })
        .expect(400)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_PASSWORD_NOT_SET');
        });
    } finally {
      if (memberId) {
        await prisma.memberUser.delete({ where: { id: memberId } });
      }
    }
  });

  it('PATCH /api/v1/auth/me 仅 displayName 写审计；null 清空', async () => {
    const email = `e2e-dn-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    let memberId: string | undefined;
    try {
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      memberId = (reg.body as ApiSuccess<{ memberId: string }>).data.memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;

      const p1 = await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: '  E2E昵称  ' })
        .expect(200);
      expect(
        (p1.body as ApiSuccess<{ displayName: string | null }>).data
          .displayName,
      ).toBe('E2E昵称');

      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.MEMBER_PROFILE_UPDATE,
          targetId: memberId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();
      expect(aud!.payload).toEqual({ displayName: 'E2E昵称' });

      const p2 = await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: null })
        .expect(200);
      expect(
        (p2.body as ApiSuccess<{ displayName: string | null }>).data
          .displayName,
      ).toBeNull();

      const g = await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (g.body as ApiSuccess<{ displayName: string | null }>).data.displayName,
      ).toBeNull();
    } finally {
      if (memberId) {
        await prisma.auditLog.deleteMany({
          where: {
            action: AuditAction.MEMBER_PROFILE_UPDATE,
            targetId: memberId,
          },
        });
      }
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('PATCH /api/v1/auth/me 仅 currentPassword 422', async () => {
    const email = `e2e-pw-half-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    try {
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: password })
        .expect(422);
    } finally {
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('PATCH /api/v1/auth/me 当前密码错误 400', async () => {
    const email = `e2e-pw-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    try {
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPass11!!',
          newPassword: 'E2ePass22@@',
        })
        .expect(400)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_CURRENT_PASSWORD_INVALID');
        });
    } finally {
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('PATCH /api/v1/auth/me 新密码与当前相同 400', async () => {
    const email = `e2e-pw-reuse-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    try {
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: password, newPassword: password })
        .expect(400)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_NEW_PASSWORD_REUSE');
        });
    } finally {
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('PATCH /api/v1/auth/me 成功改密、审计与重新登录', async () => {
    const email = `e2e-pw2-${randomUUID()}@x.test`;
    const oldPassword = 'E2ePass11!!';
    const newPassword = 'E2ePass22@@';
    const prisma = app.get(PrismaService);
    let memberId: string | undefined;
    try {
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password: oldPassword })
        .expect(201);
      memberId = (reg.body as ApiSuccess<{ memberId: string }>).data.memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: oldPassword })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;

      const patchRes = await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: oldPassword, newPassword })
        .expect(200);
      const pb = patchRes.body as ApiSuccess<{
        memberId: string;
        email: string;
        displayName: string | null;
      }>;
      expect(pb.data.memberId).toBe(memberId);
      expect(pb.data.email).toBe(email.toLowerCase());
      expect(pb.data.displayName).toBeNull();

      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.MEMBER_PASSWORD_CHANGE,
          targetId: memberId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();

      await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: oldPassword })
        .expect(401);
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: newPassword })
        .expect(200);
    } finally {
      if (memberId) {
        await prisma.auditLog.deleteMany({
          where: {
            action: AuditAction.MEMBER_PASSWORD_CHANGE,
            targetId: memberId,
          },
        });
      }
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('GET /api/v1/member-notification-preferences 无 Token 401', () => {
    return request(server())
      .get('/api/v1/member-notification-preferences')
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
      });
  });

  it('GET /api/v1/member-notification-preferences 默认合并；PATCH 后持久化与审计', async () => {
    const email = `e2e-np-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    let memberId: string | undefined;
    try {
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      memberId = (reg.body as ApiSuccess<{ memberId: string }>).data.memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;

      const g0 = await request(server())
        .get('/api/v1/member-notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const b0 = g0.body as ApiSuccess<{
        memberId: string;
        channelInApp: boolean;
        channelMiniProgram: boolean;
        updatedAt: string | null;
      }>;
      expect(b0.data.memberId).toBe(memberId);
      expect(b0.data.channelInApp).toBe(true);
      expect(b0.data.channelMiniProgram).toBe(false);
      expect(b0.data.updatedAt).toBeNull();

      const prefRow0 = await prisma.memberNotificationPreference.findUnique({
        where: { memberId: memberId },
      });
      expect(prefRow0).toBeNull();

      const patchRes = await request(server())
        .patch('/api/v1/member-notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ channelMiniProgram: true })
        .expect(200);
      const pb = patchRes.body as ApiSuccess<{
        channelInApp: boolean;
        channelMiniProgram: boolean;
        updatedAt: string | null;
      }>;
      expect(pb.data.channelInApp).toBe(true);
      expect(pb.data.channelMiniProgram).toBe(true);
      expect(pb.data.updatedAt).not.toBeNull();

      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.MEMBER_NOTIFICATION_PREFERENCE_UPDATE,
          targetId: memberId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();
      expect(aud!.payload).toEqual(
        expect.objectContaining({
          channelInApp: true,
          channelMiniProgram: true,
        }),
      );

      const g1 = await request(server())
        .get('/api/v1/member-notification-preferences')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const b1 = g1.body as ApiSuccess<{
        channelMiniProgram: boolean;
        updatedAt: string | null;
      }>;
      expect(b1.data.channelMiniProgram).toBe(true);
      expect(b1.data.updatedAt).not.toBeNull();
    } finally {
      if (memberId) {
        await prisma.auditLog.deleteMany({
          where: {
            action: AuditAction.MEMBER_NOTIFICATION_PREFERENCE_UPDATE,
            targetId: memberId,
          },
        });
        await prisma.memberNotificationPreference.deleteMany({
          where: { memberId },
        });
      }
      await prisma.memberUser.deleteMany({
        where: { email: email.toLowerCase() },
      });
    }
  });

  it('GET /api/v1/in-app-notifications 无 Token 401', () => {
    return request(server())
      .get('/api/v1/in-app-notifications')
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
      });
  });

  it('GET 站内信分页与 onlyUnread；PATCH 已读幂等；他人通知 404', async () => {
    const emailA = `e2e-ian-a-${randomUUID()}@x.test`;
    const emailB = `e2e-ian-b-${randomUUID()}@x.test`;
    const password = 'E2ePass11!!';
    const prisma = app.get(PrismaService);
    let memberIdA: string | undefined;
    let memberIdB: string | undefined;
    let nidAUnread: string | undefined;
    let nidARead: string | undefined;
    let nidB: string | undefined;
    try {
      const regA = await request(server())
        .post('/api/v1/auth/register')
        .send({ email: emailA, password })
        .expect(201);
      memberIdA = (regA.body as ApiSuccess<{ memberId: string }>).data.memberId;
      const regB = await request(server())
        .post('/api/v1/auth/register')
        .send({ email: emailB, password })
        .expect(201);
      memberIdB = (regB.body as ApiSuccess<{ memberId: string }>).data.memberId;

      const loginA = await request(server())
        .post('/api/v1/auth/login')
        .send({ email: emailA, password })
        .expect(200);
      const tokenA = (loginA.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;

      nidAUnread = randomUUID();
      nidARead = randomUUID();
      nidB = randomUUID();
      await prisma.inAppNotification.createMany({
        data: [
          {
            id: nidAUnread,
            memberId: memberIdA,
            category: 'e2e',
            title: 'u',
            body: 'unread',
          },
          {
            id: nidARead,
            memberId: memberIdA,
            category: 'e2e',
            title: 'r',
            body: 'read',
            readAt: new Date(),
          },
        ],
      });
      await prisma.inAppNotification.create({
        data: {
          id: nidB,
          memberId: memberIdB,
          category: 'e2e',
          title: 'b',
          body: 'other member',
        },
      });

      const listAll = await request(server())
        .get('/api/v1/in-app-notifications?page=1&pageSize=20')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const la = listAll.body as ApiSuccess<{
        items: { id: string }[];
        total: number;
      }>;
      expect(la.data.total).toBe(2);
      expect(la.data.items).toHaveLength(2);
      expect(new Set(la.data.items.map((i) => i.id))).toEqual(
        new Set([nidAUnread, nidARead]),
      );

      const listUnread = await request(server())
        .get('/api/v1/in-app-notifications?onlyUnread=true&pageSize=10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const lu = listUnread.body as ApiSuccess<{
        items: { id: string }[];
        total: number;
      }>;
      expect(lu.data.total).toBe(1);
      expect(lu.data.items[0].id).toBe(nidAUnread);

      const patch1 = await request(server())
        .patch(`/api/v1/in-app-notifications/${nidAUnread}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const p1 = patch1.body as ApiSuccess<{ readAt: string | null }>;
      expect(p1.data.readAt).not.toBeNull();

      const patchAgain = await request(server())
        .patch(`/api/v1/in-app-notifications/${nidAUnread}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const p2 = patchAgain.body as ApiSuccess<{ readAt: string | null }>;
      expect(p2.data.readAt).toBe(p1.data.readAt);

      await request(server())
        .patch(`/api/v1/in-app-notifications/${nidB}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      await request(server())
        .patch('/api/v1/in-app-notifications/not-a-uuid')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      await request(server())
        .patch(`/api/v1/in-app-notifications/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    } finally {
      const ids = [nidAUnread, nidARead, nidB].filter(
        (x): x is string => typeof x === 'string',
      );
      if (ids.length) {
        await prisma.inAppNotification.deleteMany({
          where: { id: { in: ids } },
        });
      }
      await prisma.memberUser.deleteMany({
        where: {
          email: { in: [emailA.toLowerCase(), emailB.toLowerCase()] },
        },
      });
    }
  });

  it('POST 兑换无 Authorization 返回 401 与草案码', () => {
    return request(server())
      .post('/api/v1/redemption-codes/actions/redeem')
      .send({ code: 'TEST' })
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
        expect(body.traceId).toBeDefined();
      });
  });

  describe('POST /api/v1/redemption-codes/actions/redeem（持久化 + JWT）', () => {
    let prisma: PrismaService;
    let ownerMemberId: string;
    let accessToken: string;
    let contentId: string;
    const goodPlainCode = 'e2e-redeem-good-001';
    const email = () => `e2e-${randomUUID()}@x.test`;
    let registeredEmail: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      registeredEmail = email();
      const password = 'E2ePass11!!';
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email: registeredEmail, password })
        .expect(201);
      ownerMemberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const loginRes = await request(server())
        .post('/api/v1/auth/login')
        .send({ email: registeredEmail, password })
        .expect(200);
      accessToken = (loginRes.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;

      const content = await prisma.content.create({
        data: { placeholderKind: 'PLACEHOLDER' },
      });
      contentId = content.id;
      const entitlement = await prisma.contentEntitlement.create({
        data: { contentId: content.id },
      });
      await prisma.redemptionCode.create({
        data: {
          entitlementId: entitlement.id,
          codeHash: hashRedemptionCode(goodPlainCode),
        },
      });
    });

    afterEach(async () => {
      await prisma.memberNotificationPreference.deleteMany({
        where: { memberId: ownerMemberId },
      });
      await prisma.inAppNotification.deleteMany({
        where: { memberId: ownerMemberId },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ targetId: contentId }, { actorMemberId: ownerMemberId }],
        },
      });
      await prisma.content.deleteMany({ where: { id: contentId } });
      await prisma.memberUser.deleteMany({ where: { id: ownerMemberId } });
    });

    it('有效 JWT 且码正确时 200 并写入 Owner', async () => {
      const res = await request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: goodPlainCode })
        .expect(200);
      const body = res.body as ApiSuccess<{
        contentId: string;
        ownerMemberId: string;
      }>;
      expect(body.success).toBe(true);
      expect(body.data.ownerMemberId).toBe(ownerMemberId);
      expect(body.data.contentId).toBe(contentId);
      const updated = await prisma.content.findUniqueOrThrow({
        where: { id: contentId },
      });
      expect(updated.ownerMemberId).toBe(ownerMemberId);
      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.CONTENT_REDEEM_SUCCESS,
          targetId: contentId,
        },
      });
      expect(aud).not.toBeNull();
      expect(aud!.actorMemberId).toBe(ownerMemberId);

      const notif = await prisma.inAppNotification.findFirst({
        where: {
          memberId: ownerMemberId,
          category: InAppNotificationCategory.CONTENT_REDEEM_SUCCESS,
        },
      });
      expect(notif).not.toBeNull();
      expect(notif!.data).toEqual(
        expect.objectContaining({
          contentId,
          entitlementId: expect.any(String),
          redemptionCodeId: expect.any(String),
        }),
      );
    });

    it('channelInApp 为 false 时兑换成功但不写站内信', async () => {
      await prisma.memberNotificationPreference.create({
        data: {
          memberId: ownerMemberId,
          channelInApp: false,
          channelMiniProgram: false,
        },
      });
      const res = await request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: goodPlainCode })
        .expect(200);
      const body = res.body as ApiSuccess<{
        contentId: string;
        ownerMemberId: string;
      }>;
      expect(body.data.ownerMemberId).toBe(ownerMemberId);
      const n = await prisma.inAppNotification.count({
        where: { memberId: ownerMemberId },
      });
      expect(n).toBe(0);
    });

    it('码不存在时 404 并写兑换失败审计', async () => {
      await request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'no-such-code-plaintext' })
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.success).toBe(false);
          expect(body.error.code).toBe('CONTENT_REDEMPTION_CODE_NOT_FOUND');
        });
      const failAud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.CONTENT_REDEEM_FAILURE,
          actorMemberId: ownerMemberId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(failAud).not.toBeNull();
      expect(failAud!.targetType).toBe('MemberUser');
      expect(failAud!.targetId).toBe(ownerMemberId);
      expect(failAud!.payload).toEqual(
        expect.objectContaining({
          errorCode: 'CONTENT_REDEMPTION_CODE_NOT_FOUND',
        }),
      );
    });

    it('码已失效时 400 并写兑换失败审计', async () => {
      const entitlement = await prisma.contentEntitlement.findUniqueOrThrow({
        where: { contentId },
      });
      const codeRow = await prisma.redemptionCode.findFirstOrThrow({
        where: { entitlementId: entitlement.id },
      });
      await prisma.redemptionCode.update({
        where: { id: codeRow.id },
        data: {
          status: 'INVALIDATED',
          invalidatedAt: new Date(),
        },
      });
      try {
        await request(server())
          .post('/api/v1/redemption-codes/actions/redeem')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ code: goodPlainCode })
          .expect(400)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_REDEMPTION_CODE_INVALIDATED');
          });
        const failAud = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_REDEEM_FAILURE,
            targetId: codeRow.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(failAud).not.toBeNull();
        expect(failAud!.payload).toEqual(
          expect.objectContaining({
            errorCode: 'CONTENT_REDEMPTION_CODE_INVALIDATED',
            redemptionCodeId: codeRow.id,
          }),
        );
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [{ targetId: codeRow.id }, { actorMemberId: ownerMemberId }],
          },
        });
        await prisma.redemptionCode.update({
          where: { id: codeRow.id },
          data: { status: 'ACTIVE', invalidatedAt: null },
        });
      }
    });

    it('重复兑换时第二次 409 并写兑换失败审计', async () => {
      await request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: goodPlainCode })
        .expect(200);
      await request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: goodPlainCode })
        .expect(409);
      const entitlement = await prisma.contentEntitlement.findUniqueOrThrow({
        where: { contentId },
      });
      const codeRow = await prisma.redemptionCode.findFirstOrThrow({
        where: { entitlementId: entitlement.id },
      });
      const failAud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.CONTENT_REDEEM_FAILURE,
          targetId: codeRow.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(failAud).not.toBeNull();
      expect(failAud!.payload).toEqual(
        expect.objectContaining({
          errorCode: 'CONTENT_REDEMPTION_CODE_ALREADY_USED',
        }),
      );
    });

    it('Bearer 非合法 JWT 时 401 AUTH_INVALID_TOKEN', () => {
      return request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', 'Bearer not-a-jwt')
        .send({ code: goodPlainCode })
        .expect(401)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_INVALID_TOKEN');
        });
    });

    it('JWT sub 在库中无用户时 401 AUTH_INVALID_TOKEN', async () => {
      const jwt = app.get(JwtService);
      const orphanToken = await jwt.signAsync(
        {},
        { subject: randomUUID(), expiresIn: '1h' },
      );
      return request(server())
        .post('/api/v1/redemption-codes/actions/redeem')
        .set('Authorization', `Bearer ${orphanToken}`)
        .send({ code: goodPlainCode })
        .expect(401)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_INVALID_TOKEN');
        });
    });
  });

  describe('GET /api/v1/contents/:contentId', () => {
    let prisma: PrismaService;

    beforeEach(() => {
      prisma = app.get(PrismaService);
    });

    it('非法 id 形态 404 NOT_FOUND', () => {
      return request(server())
        .get('/api/v1/contents/not-a-uuid')
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.success).toBe(false);
          expect(body.error.code).toBe('NOT_FOUND');
        });
    });

    it('匿名可读 PUBLISHED 且 NORMAL', async () => {
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
          title: 'e2e-public',
          body: { v: 1 },
        },
      });
      try {
        const res = await request(server())
          .get(`/api/v1/contents/${id}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          id: string;
          title: string | null;
          publishStatus: string;
        }>;
        expect(body.success).toBe(true);
        expect(body.data.id).toBe(id);
        expect(body.data.title).toBe('e2e-public');
        expect(body.data.publishStatus).toBe('PUBLISHED');
      } finally {
        await prisma.content.delete({ where: { id } });
      }
    });

    it('匿名可读 SUSPICIOUS_PUBLISHED 且 NORMAL（PRD 疑似先发布）', async () => {
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          publishStatus: 'SUSPICIOUS_PUBLISHED',
          listingState: 'NORMAL',
          title: 'e2e-suspicious',
        },
      });
      try {
        const res = await request(server())
          .get(`/api/v1/contents/${id}`)
          .expect(200);
        const body = res.body as ApiSuccess<{ publishStatus: string }>;
        expect(body.data.publishStatus).toBe('SUSPICIOUS_PUBLISHED');
      } finally {
        await prisma.content.delete({ where: { id } });
      }
    });

    it('匿名不可读 DRAFT', async () => {
      const id = randomUUID();
      await prisma.content.create({
        data: { id, publishStatus: 'DRAFT', listingState: 'NORMAL' },
      });
      try {
        await request(server()).get(`/api/v1/contents/${id}`).expect(404);
      } finally {
        await prisma.content.delete({ where: { id } });
      }
    });

    it('已发布但平台下架时匿名 404', async () => {
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          publishStatus: 'PUBLISHED',
          listingState: 'PLATFORM_UNLISTED',
        },
      });
      try {
        await request(server()).get(`/api/v1/contents/${id}`).expect(404);
      } finally {
        await prisma.content.delete({ where: { id } });
      }
    });

    it('Owner 凭 JWT 可读 DRAFT', async () => {
      const email = `e2e-content-${randomUUID()}@x.test`;
      const password = 'E2ePass11!!';
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const loginRes = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const accessToken = (loginRes.body as ApiSuccess<MemberAuthTokenPairDto>)
        .data.accessToken;

      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          ownerMemberId: memberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
          title: 'draft-only',
        },
      });
      try {
        const res = await request(server())
          .get(`/api/v1/contents/${id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{ publishStatus: string }>;
        expect(body.data.publishStatus).toBe('DRAFT');
      } finally {
        await prisma.content.delete({ where: { id } });
        await prisma.memberUser.delete({ where: { id: memberId } });
      }
    });

    it('携带非法 Bearer 时 401 AUTH_INVALID_TOKEN', () => {
      return request(server())
        .get(`/api/v1/contents/${randomUUID()}`)
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('AUTH_INVALID_TOKEN');
        });
    });
  });

  describe('PATCH / POST 内容写（Owner）', () => {
    let prisma: PrismaService;

    beforeEach(() => {
      prisma = app.get(PrismaService);
    });

    async function registerAndToken(): Promise<{
      memberId: string;
      token: string;
    }> {
      const email = `e2e-write-${randomUUID()}@x.test`;
      const password = 'E2ePass11!!';
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const loginRes = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (loginRes.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      return { memberId, token };
    }

    it('PATCH 无 Authorization 时 401 AUTH_UNAUTHORIZED', async () => {
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .patch(`/api/v1/contents/${id}`)
          .send({ title: 'x' })
          .expect(401)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('AUTH_UNAUTHORIZED');
          });
      } finally {
        await prisma.content.delete({ where: { id } });
      }
    });

    it('PATCH 缺 title/body 时 422', async () => {
      const { memberId, token } = await registerAndToken();
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          ownerMemberId: memberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .patch(`/api/v1/contents/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(422);
      } finally {
        await prisma.content.delete({ where: { id } });
        await prisma.memberUser.delete({ where: { id: memberId } });
      }
    });

    it('Owner PATCH 标题后 submit-publish，匿名可读', async () => {
      const { memberId, token } = await registerAndToken();
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          ownerMemberId: memberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
          title: 'old',
        },
      });
      try {
        const patchRes = await request(server())
          .patch(`/api/v1/contents/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'new-title' })
          .expect(200);
        expect(
          (patchRes.body as ApiSuccess<{ title: string | null }>).data.title,
        ).toBe('new-title');

        const pubRes = await request(server())
          .post(`/api/v1/contents/${id}/actions/submit-publish`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(
          (pubRes.body as ApiSuccess<{ publishStatus: string }>).data
            .publishStatus,
        ).toBe('SUBMITTED');

        const jobQueued = await prisma.moderationJob.findFirst({
          where: { contentId: id, subjectType: 'CONTENT' },
          orderBy: { createdAt: 'desc' },
        });
        expect(jobQueued).not.toBeNull();
        expect(jobQueued!.state).toBe('QUEUED');

        await app.get(ContentModerationProcessorService).processQueuedBatch();

        const job = await prisma.moderationJob.findFirst({
          where: { contentId: id, subjectType: 'CONTENT' },
          orderBy: { createdAt: 'desc' },
        });
        expect(job).not.toBeNull();
        expect(job!.state).toBe('COMPLETED');

        const modAudit = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_MODERATION_OUTCOME,
            targetId: id,
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(modAudit).not.toBeNull();
        expect(modAudit!.payload).toEqual(
          expect.objectContaining({
            moderationOutcome: 'APPROVED',
            toPublishStatus: 'PUBLISHED',
          }),
        );

        const modNotif = await prisma.inAppNotification.findFirst({
          where: {
            memberId,
            category: InAppNotificationCategory.CONTENT_MODERATION_APPROVED,
          },
        });
        expect(modNotif).not.toBeNull();
        expect(modNotif!.data).toEqual(
          expect.objectContaining({
            contentId: id,
            publishStatus: 'PUBLISHED',
          }),
        );

        const anon = await request(server())
          .get(`/api/v1/contents/${id}`)
          .expect(200);
        expect(
          (anon.body as ApiSuccess<{ title: string | null }>).data.title,
        ).toBe('new-title');

        await request(server())
          .post(`/api/v1/contents/${id}/actions/submit-publish`)
          .set('Authorization', `Bearer ${token}`)
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe(
              'CONTENT_SUBMIT_PUBLISH_FORBIDDEN_STATE',
            );
          });

        await request(server())
          .patch(`/api/v1/contents/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'blocked' })
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_PATCH_FORBIDDEN_STATE');
          });
      } finally {
        await prisma.inAppNotification.deleteMany({
          where: { memberId },
        });
        await prisma.auditLog.deleteMany({ where: { targetId: id } });
        await prisma.content.delete({ where: { id } });
        await prisma.memberUser.delete({ where: { id: memberId } });
      }
    });

    it('非 Owner PATCH 403', async () => {
      const a = await registerAndToken();
      const b = await registerAndToken();
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          ownerMemberId: a.memberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .patch(`/api/v1/contents/${id}`)
          .set('Authorization', `Bearer ${b.token}`)
          .send({ title: 'hack' })
          .expect(403)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_OWNER_ACTION_FORBIDDEN');
          });
      } finally {
        await prisma.content.delete({ where: { id } });
        await prisma.memberUser.delete({ where: { id: a.memberId } });
        await prisma.memberUser.delete({ where: { id: b.memberId } });
      }
    });
  });

  describe('noop 机审 CONTENT_MODERATION_NOOP_OUTCOME', () => {
    let prisma: PrismaService;

    beforeEach(() => {
      prisma = app.get(PrismaService);
    });

    describe('reject', () => {
      beforeEach(() => {
        process.env.CONTENT_MODERATION_NOOP_OUTCOME = 'reject';
      });
      afterEach(() => {
        delete process.env.CONTENT_MODERATION_NOOP_OUTCOME;
      });

      it('submit-publish 经 worker 后为 MACHINE_REJECTED；访客不可读', async () => {
        const email = `e2e-noop-rej-${randomUUID()}@x.test`;
        const password = 'E2ePass11!!';
        const reg = await request(server())
          .post('/api/v1/auth/register')
          .send({ email, password })
          .expect(201);
        const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
          .memberId;
        const loginRes = await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password })
          .expect(200);
        const token = (loginRes.body as ApiSuccess<MemberAuthTokenPairDto>).data
          .accessToken;

        const id = randomUUID();
        await prisma.content.create({
          data: {
            id,
            ownerMemberId: memberId,
            publishStatus: 'DRAFT',
            listingState: 'NORMAL',
            title: 'rej',
          },
        });
        try {
          await request(server())
            .post(`/api/v1/contents/${id}/actions/submit-publish`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

          await app.get(ContentModerationProcessorService).processQueuedBatch();

          const row = await prisma.content.findUniqueOrThrow({
            where: { id },
          });
          expect(row.publishStatus).toBe('MACHINE_REJECTED');

          const job = await prisma.moderationJob.findFirst({
            where: { contentId: id, subjectType: 'CONTENT' },
            orderBy: { createdAt: 'desc' },
          });
          expect(job?.state).toBe('COMPLETED');
          expect(job?.resultPayload).toEqual(
            expect.objectContaining({ outcome: 'REJECTED' }),
          );

          await request(server()).get(`/api/v1/contents/${id}`).expect(404);

          const ownerRead = await request(server())
            .get(`/api/v1/contents/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(
            (ownerRead.body as ApiSuccess<{ publishStatus: string }>).data
              .publishStatus,
          ).toBe('MACHINE_REJECTED');

          const modAudit = await prisma.auditLog.findFirst({
            where: {
              action: AuditAction.CONTENT_MODERATION_OUTCOME,
              targetId: id,
            },
            orderBy: { createdAt: 'desc' },
          });
          expect(modAudit?.payload).toEqual(
            expect.objectContaining({
              moderationOutcome: 'REJECTED',
              toPublishStatus: 'MACHINE_REJECTED',
            }),
          );

          const rejNotif = await prisma.inAppNotification.findFirst({
            where: {
              memberId,
              category: InAppNotificationCategory.CONTENT_MODERATION_REJECTED,
            },
          });
          expect(rejNotif).not.toBeNull();
          expect(rejNotif!.data).toEqual(
            expect.objectContaining({
              contentId: id,
              publishStatus: 'MACHINE_REJECTED',
            }),
          );
        } finally {
          await prisma.inAppNotification.deleteMany({
            where: { memberId },
          });
          await prisma.auditLog.deleteMany({ where: { targetId: id } });
          await prisma.moderationJob.deleteMany({ where: { contentId: id } });
          await prisma.content.delete({ where: { id } });
          await prisma.memberUser.delete({ where: { id: memberId } });
        }
      });
    });

    describe('suspicious', () => {
      beforeEach(() => {
        process.env.CONTENT_MODERATION_NOOP_OUTCOME = 'suspicious';
      });
      afterEach(() => {
        delete process.env.CONTENT_MODERATION_NOOP_OUTCOME;
      });

      it('submit-publish 经 worker 后为 SUSPICIOUS_PUBLISHED；访客可读', async () => {
        const email = `e2e-noop-sus-${randomUUID()}@x.test`;
        const password = 'E2ePass11!!';
        const reg = await request(server())
          .post('/api/v1/auth/register')
          .send({ email, password })
          .expect(201);
        const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
          .memberId;
        const loginRes = await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password })
          .expect(200);
        const token = (loginRes.body as ApiSuccess<MemberAuthTokenPairDto>).data
          .accessToken;

        const id = randomUUID();
        await prisma.content.create({
          data: {
            id,
            ownerMemberId: memberId,
            publishStatus: 'DRAFT',
            listingState: 'NORMAL',
            title: 'sus',
          },
        });
        try {
          await request(server())
            .post(`/api/v1/contents/${id}/actions/submit-publish`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

          await app.get(ContentModerationProcessorService).processQueuedBatch();

          const row = await prisma.content.findUniqueOrThrow({
            where: { id },
          });
          expect(row.publishStatus).toBe('SUSPICIOUS_PUBLISHED');

          const job = await prisma.moderationJob.findFirst({
            where: { contentId: id, subjectType: 'CONTENT' },
            orderBy: { createdAt: 'desc' },
          });
          expect(job?.resultPayload).toEqual(
            expect.objectContaining({ outcome: 'SUSPICIOUS' }),
          );

          const anon = await request(server())
            .get(`/api/v1/contents/${id}`)
            .expect(200);
          expect(
            (anon.body as ApiSuccess<{ publishStatus: string }>).data
              .publishStatus,
          ).toBe('SUSPICIOUS_PUBLISHED');

          const modAudit = await prisma.auditLog.findFirst({
            where: {
              action: AuditAction.CONTENT_MODERATION_OUTCOME,
              targetId: id,
            },
            orderBy: { createdAt: 'desc' },
          });
          expect(modAudit?.payload).toEqual(
            expect.objectContaining({
              moderationOutcome: 'SUSPICIOUS',
              toPublishStatus: 'SUSPICIOUS_PUBLISHED',
            }),
          );

          const susNotif = await prisma.inAppNotification.findFirst({
            where: {
              memberId,
              category: InAppNotificationCategory.CONTENT_MODERATION_SUSPICIOUS,
            },
          });
          expect(susNotif).not.toBeNull();
          expect(susNotif!.data).toEqual(
            expect.objectContaining({
              contentId: id,
              publishStatus: 'SUSPICIOUS_PUBLISHED',
            }),
          );
        } finally {
          await prisma.inAppNotification.deleteMany({
            where: { memberId },
          });
          await prisma.auditLog.deleteMany({ where: { targetId: id } });
          await prisma.moderationJob.deleteMany({ where: { contentId: id } });
          await prisma.content.delete({ where: { id } });
          await prisma.memberUser.delete({ where: { id: memberId } });
        }
      });
    });
  });

  describe('评论（contents/.../comments）', () => {
    let prisma: PrismaService;

    beforeEach(() => {
      prisma = app.get(PrismaService);
    });

    async function registerMember(): Promise<{
      memberId: string;
      token: string;
    }> {
      const email = `e2e-cm-${randomUUID()}@x.test`;
      const password = 'E2ePass11!!';
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      return { memberId, token };
    }

    it('已发布内容匿名列表；登录发锚点与串内；作者/Owner 可删', async () => {
      const owner = await registerMember();
      const other = await registerMember();
      const contentId = randomUUID();
      await prisma.content.create({
        data: {
          id: contentId,
          ownerMemberId: owner.memberId,
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
          title: 'c',
        },
      });
      try {
        const empty = await request(server())
          .get(`/api/v1/contents/${contentId}/comments`)
          .expect(200);
        expect((empty.body as ApiSuccess<{ total: number }>).data.total).toBe(
          0,
        );

        await request(server())
          .post(`/api/v1/contents/${contentId}/comments`)
          .send({ body: { t: 1 } })
          .expect(401);

        const postAnchor = await request(server())
          .post(`/api/v1/contents/${contentId}/comments`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ body: { text: '锚' } })
          .expect(201);
        const anchorId = (postAnchor.body as ApiSuccess<{ id: string }>).data
          .id;

        const postThread = await request(server())
          .post(`/api/v1/contents/${contentId}/comments`)
          .set('Authorization', `Bearer ${other.token}`)
          .send({
            body: { text: '串' },
            anchorId,
            replyToCommentId: anchorId,
          })
          .expect(201);
        const threadId = (postThread.body as ApiSuccess<{ id: string }>).data
          .id;

        const list = await request(server())
          .get(`/api/v1/contents/${contentId}/comments`)
          .expect(200);
        expect((list.body as ApiSuccess<{ total: number }>).data.total).toBe(2);

        const audCreate = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_COMMENT_CREATE,
            targetId: anchorId,
          },
        });
        expect(audCreate).not.toBeNull();

        await request(server())
          .delete(`/api/v1/comments/${threadId}`)
          .set('Authorization', `Bearer ${other.token}`)
          .expect(200);

        await request(server())
          .delete(`/api/v1/comments/${anchorId}`)
          .set('Authorization', `Bearer ${owner.token}`)
          .expect(200);

        const audDel = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_COMMENT_DELETE,
            targetId: anchorId,
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(audDel).not.toBeNull();
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            action: {
              in: [
                AuditAction.CONTENT_COMMENT_CREATE,
                AuditAction.CONTENT_COMMENT_DELETE,
              ],
            },
            actorMemberId: { in: [owner.memberId, other.memberId] },
          },
        });
        await prisma.comment.deleteMany({ where: { contentId } });
        await prisma.content.delete({ where: { id: contentId } });
        await prisma.memberUser.deleteMany({
          where: { id: { in: [owner.memberId, other.memberId] } },
        });
      }
    });

    it('非作者非 Owner 删除评论 403', async () => {
      const owner = await registerMember();
      const author = await registerMember();
      const stranger = await registerMember();
      const contentId = randomUUID();
      await prisma.content.create({
        data: {
          id: contentId,
          ownerMemberId: owner.memberId,
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
        },
      });
      const post = await request(server())
        .post(`/api/v1/contents/${contentId}/comments`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ body: { x: 1 } })
        .expect(201);
      const commentId = (post.body as ApiSuccess<{ id: string }>).data.id;
      try {
        await request(server())
          .delete(`/api/v1/comments/${commentId}`)
          .set('Authorization', `Bearer ${stranger.token}`)
          .expect(403)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_COMMENT_DELETE_FORBIDDEN');
          });
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            action: AuditAction.CONTENT_COMMENT_CREATE,
            targetId: commentId,
          },
        });
        await prisma.comment.deleteMany({ where: { contentId } });
        await prisma.content.delete({ where: { id: contentId } });
        await prisma.memberUser.deleteMany({
          where: {
            id: { in: [owner.memberId, author.memberId, stranger.memberId] },
          },
        });
      }
    });
  });

  describe('内容转让 transfers', () => {
    let prisma: PrismaService;

    beforeEach(() => {
      prisma = app.get(PrismaService);
    });

    async function registerMember(): Promise<{
      memberId: string;
      token: string;
    }> {
      const email = `e2e-tr-${randomUUID()}@x.test`;
      const password = 'E2ePass11!!';
      const reg = await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);
      const memberId = (reg.body as ApiSuccess<{ memberId: string }>).data
        .memberId;
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const token = (login.body as ApiSuccess<MemberAuthTokenPairDto>).data
        .accessToken;
      return { memberId, token };
    }

    /** 走 submit-publish + noop worker，得到 **`PUBLISHED`**。 */
    async function publishContent(
      ownerMemberId: string,
      ownerToken: string,
    ): Promise<string> {
      const id = randomUUID();
      await prisma.content.create({
        data: {
          id,
          ownerMemberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
          title: 'tr0',
        },
      });
      await request(server())
        .patch(`/api/v1/contents/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'tr1' })
        .expect(200);
      await request(server())
        .post(`/api/v1/contents/${id}/actions/submit-publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      await app.get(ContentModerationProcessorService).processQueuedBatch();
      const row = await prisma.content.findUniqueOrThrow({ where: { id } });
      expect(row.publishStatus).toBe('PUBLISHED');
      return id;
    }

    async function teardownContentAndMembers(
      contentId: string,
      memberIds: string[],
    ): Promise<void> {
      await prisma.inAppNotification.deleteMany({
        where: { memberId: { in: memberIds } },
      });
      const transferIds = (
        await prisma.contentTransfer.findMany({
          where: { contentId },
          select: { id: true },
        })
      ).map((r) => r.id);
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { targetId: contentId },
            ...(transferIds.length > 0
              ? [{ targetId: { in: transferIds } }]
              : []),
            { actorMemberId: { in: memberIds } },
          ],
        },
      });
      await prisma.moderationJob.deleteMany({ where: { contentId } });
      await prisma.content.deleteMany({ where: { id: contentId } });
      await prisma.memberUser.deleteMany({
        where: { id: { in: memberIds } },
      });
    }

    it('TRANSFER_CODE 发起后受让人确认，Owner 变更且写审计', async () => {
      const owner = await registerMember();
      const buyer = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        const initBody = init.body as ApiSuccess<{
          transferId: string;
          transferCode?: string;
        }>;
        transferId = initBody.data.transferId;
        const code = initBody.data.transferCode;
        expect(code).toBeDefined();

        const audCreate = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_TRANSFER_CREATE,
            targetId: transferId,
          },
        });
        expect(audCreate).not.toBeNull();

        const conf = await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ transferCode: code })
          .expect(200);
        expect(
          (conf.body as ApiSuccess<{ ok: boolean; contentId: string }>).data,
        ).toEqual({ ok: true, contentId });

        const content = await prisma.content.findUniqueOrThrow({
          where: { id: contentId },
        });
        expect(content.ownerMemberId).toBe(buyer.memberId);

        const audConfirm = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_TRANSFER_CONFIRM,
            targetId: transferId,
          },
        });
        expect(audConfirm).not.toBeNull();
        expect(audConfirm!.actorMemberId).toBe(buyer.memberId);
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          buyer.memberId,
        ]);
      }
    });

    it('发起方撤销后确认返回 CONTENT_TRANSFER_INVALID_STATE', async () => {
      const owner = await registerMember();
      const buyer = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;
        const code = (init.body as ApiSuccess<{ transferCode?: string }>).data
          .transferCode;

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/revoke`)
          .set('Authorization', `Bearer ${owner.token}`)
          .expect(200);

        const audRevoke = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_TRANSFER_REVOKE,
            targetId: transferId,
          },
        });
        expect(audRevoke).not.toBeNull();

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ transferCode: code })
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_INVALID_STATE');
          });
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          buyer.memberId,
        ]);
      }
    });

    it('同一内容第二条 PENDING 409 CONTENT_TRANSFER_PENDING_CONFLICT', async () => {
      const owner = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      try {
        await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);

        await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'CARD_SHARE' })
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_PENDING_CONFLICT');
          });
      } finally {
        await teardownContentAndMembers(contentId, [owner.memberId]);
      }
    });

    it('DRAFT 发起转让 409 CONTENT_TRANSFER_FORBIDDEN_STATE', async () => {
      const owner = await registerMember();
      const contentId = randomUUID();
      await prisma.content.create({
        data: {
          id: contentId,
          ownerMemberId: owner.memberId,
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_FORBIDDEN_STATE');
          });
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            actorMemberId: owner.memberId,
            targetId: contentId,
          },
        });
        await prisma.content.delete({ where: { id: contentId } });
        await prisma.memberUser.delete({ where: { id: owner.memberId } });
      }
    });

    it('发起方自确认 400 CONTENT_TRANSFER_SELF_NOT_ALLOWED', async () => {
      const owner = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;
        const code = (init.body as ApiSuccess<{ transferCode?: string }>).data
          .transferCode;

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ transferCode: code })
          .expect(400)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_SELF_NOT_ALLOWED');
          });
      } finally {
        await teardownContentAndMembers(contentId, [owner.memberId]);
      }
    });

    it('转让码错误 400 CONTENT_TRANSFER_SECRET_MISMATCH', async () => {
      const owner = await registerMember();
      const buyer = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ transferCode: 'wrong-plain-code' })
          .expect(400)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_SECRET_MISMATCH');
          });
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          buyer.memberId,
        ]);
      }
    });

    it('过期后确认 400 CONTENT_TRANSFER_EXPIRED', async () => {
      const owner = await registerMember();
      const buyer = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;
        const code = (init.body as ApiSuccess<{ transferCode?: string }>).data
          .transferCode;

        await prisma.contentTransfer.update({
          where: { id: transferId },
          data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
        });

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ transferCode: code })
          .expect(400)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_EXPIRED');
          });
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          buyer.memberId,
        ]);
      }
    });

    it('定时任务将过期 PENDING 置为 EXPIRED 并写审计', async () => {
      const owner = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;

        await prisma.contentTransfer.update({
          where: { id: transferId },
          data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
        });

        await app.get(TransferExpiryProcessorService).expirePendingBatch();

        const row = await prisma.contentTransfer.findUniqueOrThrow({
          where: { id: transferId },
        });
        expect(row.status).toBe('EXPIRED');

        const aud = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.CONTENT_TRANSFER_EXPIRE_JOB,
            targetId: transferId,
          },
        });
        expect(aud).not.toBeNull();
        expect(aud!.actorMemberId).toBeNull();

        await app.get(TransferExpiryProcessorService).expirePendingBatch();
        const rowAgain = await prisma.contentTransfer.findUniqueOrThrow({
          where: { id: transferId },
        });
        expect(rowAgain.status).toBe('EXPIRED');
      } finally {
        await teardownContentAndMembers(contentId, [owner.memberId]);
      }
    });

    it('定时任务标 EXPIRED 后确认仍返回 CONTENT_TRANSFER_EXPIRED', async () => {
      const owner = await registerMember();
      const buyer = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      let transferId: string | undefined;
      try {
        const init = await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(201);
        transferId = (init.body as ApiSuccess<{ transferId: string }>).data
          .transferId;
        const code = (init.body as ApiSuccess<{ transferCode?: string }>).data
          .transferCode;

        await prisma.contentTransfer.update({
          where: { id: transferId },
          data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
        });
        await app.get(TransferExpiryProcessorService).expirePendingBatch();

        await request(server())
          .post(`/api/v1/transfers/${transferId}/actions/confirm`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ transferCode: code })
          .expect(400)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_TRANSFER_EXPIRED');
          });
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          buyer.memberId,
        ]);
      }
    });

    it('非 Owner 列转让 / 发起转让 403', async () => {
      const owner = await registerMember();
      const other = await registerMember();
      const contentId = await publishContent(owner.memberId, owner.token);
      try {
        await request(server())
          .get(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${other.token}`)
          .expect(403)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_OWNER_ACTION_FORBIDDEN');
          });

        await request(server())
          .post(`/api/v1/contents/${contentId}/transfers`)
          .set('Authorization', `Bearer ${other.token}`)
          .send({ method: 'TRANSFER_CODE' })
          .expect(403)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('CONTENT_OWNER_ACTION_FORBIDDEN');
          });
      } finally {
        await teardownContentAndMembers(contentId, [
          owner.memberId,
          other.memberId,
        ]);
      }
    });
  });
});
