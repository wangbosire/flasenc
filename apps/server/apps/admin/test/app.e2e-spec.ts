import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Response } from 'supertest';
import { AuditAction, PrismaService } from '@app/database';
import { hashRedemptionCode } from '@app/shared';
import { type AdminAuthTokenPairDto } from './../src/auth/admin-auth.service';
import { AdminModule } from './../src/admin.module';

type ApiSuccess<T> = { success: true; data: T; traceId: string };
type ApiFailure = {
  success: false;
  error: { code: string };
  traceId: string;
};

describe('GET /admin/v1/audit-logs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;

  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('admin/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const email = `aud-${randomUUID()}@x.test`;
    const password = 'AdminPass11!!';
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        platformAdmin: true,
      },
    });
    adminUserId = user.id;
    const loginRes = await request(server())
      .post('/admin/v1/auth/login')
      .send({ email, password })
      .expect(200);
    adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
      .accessToken;
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminUserId } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
    await app.close();
  });

  it('无 Authorization 时 401', () => {
    return request(server()).get('/admin/v1/audit-logs').expect(401);
  });

  it('from 非法时 422', () => {
    return request(server())
      .get('/admin/v1/audit-logs?from=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(422);
  });

  it('可按 action 筛选到创建权益审计', async () => {
    const c = await request(server())
      .post('/admin/v1/content-entitlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'aud-ent' })
      .expect(201);
    const { entitlementId, contentId, redemptionCodeId } = (
      c.body as ApiSuccess<{
        entitlementId: string;
        contentId: string;
        redemptionCodeId: string;
      }>
    ).data;

    const list = await request(server())
      .get(
        `/admin/v1/audit-logs?action=${AuditAction.CONTENT_ENTITLEMENT_CREATE}&page=1&pageSize=20`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = list.body as ApiSuccess<{
      items: Array<{ targetId: string; action: string }>;
      total: number;
    }>;
    expect(body.success).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(
      body.data.items.some(
        (i) => i.action === AuditAction.CONTENT_ENTITLEMENT_CREATE,
      ),
    ).toBe(true);
    expect(body.data.items.some((i) => i.targetId === entitlementId)).toBe(
      true,
    );

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: contentId },
          { targetId: entitlementId },
          { targetId: redemptionCodeId },
        ],
      },
    });
    await prisma.content.deleteMany({ where: { id: contentId } });
  });
});

describe('Admin API (e2e)', () => {
  let app: INestApplication;

  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('admin/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/v1/health 返回信封', () => {
    return request(server())
      .get('/admin/v1/health')
      .expect(200)
      .expect((res: Response) => {
        const body = res.body as ApiSuccess<{ ok: true }>;
        expect(body.success).toBe(true);
        expect(body.data.ok).toBe(true);
        expect(body.traceId).toBeDefined();
      });
  });

  it('GET /admin/v1/ 根路径返回信封', () => {
    return request(server())
      .get('/admin/v1/')
      .expect(200)
      .expect((res: Response) => {
        const body = res.body as ApiSuccess<{
          service: string;
          message: string;
        }>;
        expect(body.data.service).toBe('admin');
        expect(body.data.message).toBe('Hello World!');
      });
  });

  it('POST /admin/v1/auth/refresh 轮换双 token 并可访问受保护路由', async () => {
    const prisma = app.get(PrismaService);
    const email = `adm-refresh-${randomUUID()}@x.test`;
    const password = 'AdminPass11!!';
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, platformAdmin: true },
    });
    try {
      const login = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const d = (login.body as ApiSuccess<AdminAuthTokenPairDto>).data;
      expect(d.refreshToken.length).toBeGreaterThan(10);

      const refreshed = await request(server())
        .post('/admin/v1/auth/refresh')
        .send({ refreshToken: d.refreshToken })
        .expect(200);
      const r = (refreshed.body as ApiSuccess<AdminAuthTokenPairDto>).data;
      expect(r.accessToken).not.toBe(d.accessToken);
      expect(r.userId).toBe(user.id);

      await request(server())
        .get('/admin/v1/audit-logs?page=1&pageSize=1')
        .set('Authorization', `Bearer ${r.accessToken}`)
        .expect(200);

      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.ADMIN_AUTH_REFRESH,
          targetId: user.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(aud).not.toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it('POST /admin/v1/auth/refresh 非法 refreshToken 401 AUTH_REFRESH_INVALID', () => {
    return request(server())
      .post('/admin/v1/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('AUTH_REFRESH_INVALID');
      });
  });

  it('POST /admin/v1/content-entitlements 无 Authorization 时 401', () => {
    return request(server())
      .post('/admin/v1/content-entitlements')
      .send({})
      .expect(401)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('ADMIN_AUTH_REQUIRED');
      });
  });

  describe('POST /admin/v1/content-entitlements（已鉴权）', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;
    let contentId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;
    });

    afterEach(async () => {
      if (contentId) {
        const ent = await prisma.contentEntitlement.findUnique({
          where: { contentId },
        });
        await prisma.auditLog.deleteMany({ where: { targetId: contentId } });
        if (ent) {
          await prisma.auditLog.deleteMany({ where: { targetId: ent.id } });
        }
        await prisma.content.deleteMany({ where: { id: contentId } });
        contentId = '';
      }
      if (adminUserId) {
        await prisma.auditLog.deleteMany({
          where: { actorUserId: adminUserId },
        });
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('201 创建权益并带占位内容', async () => {
      const res = await request(server())
        .post('/admin/v1/content-entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'e2e-ent-title' })
        .expect(201);
      const body = res.body as ApiSuccess<{
        entitlementId: string;
        contentId: string;
        redemptionCodeId: string;
        plainCode: string;
      }>;
      expect(body.success).toBe(true);
      expect(body.data.plainCode.length).toBeGreaterThanOrEqual(4);
      contentId = body.data.contentId;
      const content = await prisma.content.findUniqueOrThrow({
        where: { id: body.data.contentId },
      });
      expect(content.title).toBe('e2e-ent-title');
      const ent = await prisma.contentEntitlement.findUniqueOrThrow({
        where: { id: body.data.entitlementId },
      });
      expect(ent.contentId).toBe(body.data.contentId);
      expect(ent.createdByUserId).toBe(adminUserId);
      const code = await prisma.redemptionCode.findUniqueOrThrow({
        where: { id: body.data.redemptionCodeId },
      });
      expect(code.entitlementId).toBe(body.data.entitlementId);
      expect(code.plainCode).toBe(body.data.plainCode);
      expect(code.codeHash).toBe(hashRedemptionCode(body.data.plainCode));
      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.CONTENT_ENTITLEMENT_CREATE,
          targetId: body.data.entitlementId,
        },
      });
      expect(aud).not.toBeNull();
      expect(aud!.actorUserId).toBe(adminUserId);
      expect(aud!.traceId).toBe(body.traceId);
      const audCode = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.REDEMPTION_CODE_CREATE,
          targetId: body.data.redemptionCodeId,
        },
      });
      expect(audCode).not.toBeNull();
      expect(audCode!.actorUserId).toBe(adminUserId);
    });

    it('权益已有兑换码时不得重复 POST …/redemption-codes', async () => {
      const c = await request(server())
        .post('/admin/v1/content-entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);
      const {
        entitlementId,
        contentId: cid,
        plainCode,
        redemptionCodeId,
      } = (
        c.body as ApiSuccess<{
          entitlementId: string;
          contentId: string;
          plainCode: string;
          redemptionCodeId: string;
        }>
      ).data;
      contentId = cid;

      const row = await prisma.redemptionCode.findUniqueOrThrow({
        where: { id: redemptionCodeId },
      });
      expect(row.plainCode).toBe(plainCode);
      expect(row.codeHash).toBe(hashRedemptionCode(plainCode));

      await request(server())
        .post(
          `/admin/v1/content-entitlements/${entitlementId}/redemption-codes`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(409)
        .expect((res: Response) => {
          const fail = res.body as ApiFailure;
          expect(fail.error.code).toBe(
            'CONTENT_REDEMPTION_CODE_ALREADY_ISSUED',
          );
        });
    });

    it('一体化创建内容、权益并生成兑换码', async () => {
      const res = await request(server())
        .post('/admin/v1/content-entitlements/redemption-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'e2e-code-content', plainCode: 'E2E-CODE-ONE' })
        .expect(201);
      const body = res.body as ApiSuccess<{
        entitlementId: string;
        contentId: string;
        redemptionCodeId: string;
        plainCode: string;
      }>;
      contentId = body.data.contentId;

      expect(body.data.plainCode).toBe('E2E-CODE-ONE');
      const content = await prisma.content.findUniqueOrThrow({
        where: { id: body.data.contentId },
        include: { entitlement: true },
      });
      expect(content.title).toBe('e2e-code-content');
      expect(content.entitlement?.id).toBe(body.data.entitlementId);
      const code = await prisma.redemptionCode.findUniqueOrThrow({
        where: { id: body.data.redemptionCodeId },
      });
      expect(code.entitlementId).toBe(body.data.entitlementId);
      expect(code.codeHash).toBe(hashRedemptionCode('E2E-CODE-ONE'));
      expect(code.plainCode).toBe('E2E-CODE-ONE');

      const list = await request(server())
        .get('/admin/v1/contents?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const page = list.body as ApiSuccess<{
        items: Array<{
          id: string;
          entitlementId: string | null;
          redemptionCodeCount: number;
        }>;
      }>;
      const item = page.data.items.find((r) => r.id === body.data.contentId);
      expect(item?.entitlementId).toBe(body.data.entitlementId);
      expect(item?.redemptionCodeCount).toBe(1);
    });

    it('404 权益不存在时生成码失败', () => {
      return request(server())
        .post(
          '/admin/v1/content-entitlements/00000000-0000-4000-8000-00000000abcd/redemption-codes',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('CONTENT_ENTITLEMENT_NOT_FOUND');
        });
    });

    it('C 端会员 JWT（member_users）访问管理端写接口 401', async () => {
      const member = await prisma.memberUser.create({
        data: {
          email: `mem-${randomUUID()}@x.test`,
          passwordHash: bcrypt.hashSync('MemberPass11!!', 10),
        },
      });
      const jwt = app.get(JwtService);
      const memberToken = await jwt.signAsync(
        {},
        { subject: member.id, expiresIn: '1h' },
      );
      try {
        await request(server())
          .post('/admin/v1/content-entitlements')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({})
          .expect(401)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('AUTH_INVALID_TOKEN');
          });
      } finally {
        await prisma.memberUser.delete({ where: { id: member.id } });
      }
    });

    it('平台用户非 platformAdmin 的 JWT 访问写接口 403', async () => {
      const email = `plat-${randomUUID()}@x.test`;
      const password = 'UserPass11!!';
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: bcrypt.hashSync(password, 10),
          platformAdmin: false,
        },
      });
      const jwt = app.get(JwtService);
      const userToken = await jwt.signAsync(
        {},
        { subject: user.id, expiresIn: '1h' },
      );
      try {
        await request(server())
          .post('/admin/v1/content-entitlements')
          .set('Authorization', `Bearer ${userToken}`)
          .send({})
          .expect(403)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe('ADMIN_FORBIDDEN');
          });
      } finally {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  describe('POST /admin/v1/contents/:id/actions/*（平台上架态）', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;
    let publishedContentId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-c-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;

      const row = await prisma.content.create({
        data: {
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
          title: 'e2e-pub',
        },
      });
      publishedContentId = row.id;
    });

    afterEach(async () => {
      if (publishedContentId) {
        await prisma.auditLog.deleteMany({
          where: { targetId: publishedContentId },
        });
        await prisma.content.deleteMany({ where: { id: publishedContentId } });
        publishedContentId = '';
      }
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('无 Authorization 时 401', () => {
      return request(server())
        .post(`/admin/v1/contents/${publishedContentId}/actions/unlist`)
        .expect(401)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('ADMIN_AUTH_REQUIRED');
        });
    });

    it('unlist → restore-listing 幂等恢复 NORMAL', async () => {
      const u = await request(server())
        .post(`/admin/v1/contents/${publishedContentId}/actions/unlist`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (u.body as ApiSuccess<{ listingState: string }>).data.listingState,
      ).toBe('PLATFORM_UNLISTED');

      const r = await request(server())
        .post(
          `/admin/v1/contents/${publishedContentId}/actions/restore-listing`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (r.body as ApiSuccess<{ listingState: string }>).data.listingState,
      ).toBe('NORMAL');

      const r2 = await request(server())
        .post(
          `/admin/v1/contents/${publishedContentId}/actions/restore-listing`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (r2.body as ApiSuccess<{ listingState: string }>).data.listingState,
      ).toBe('NORMAL');
    });

    it('hide 后置 EMERGENCY_HIDDEN', async () => {
      const h = await request(server())
        .post(`/admin/v1/contents/${publishedContentId}/actions/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (h.body as ApiSuccess<{ listingState: string }>).data.listingState,
      ).toBe('EMERGENCY_HIDDEN');
      const aud = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.PLATFORM_CONTENT_HIDE,
          targetId: publishedContentId,
        },
      });
      expect(aud).not.toBeNull();
      expect(aud!.actorUserId).toBe(adminUserId);
    });

    it('草稿内容不可 unlist（409）', async () => {
      const draft = await prisma.content.create({
        data: {
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .post(`/admin/v1/contents/${draft.id}/actions/unlist`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe(
              'CONTENT_PLATFORM_LISTING_ACTION_INVALID_STATE',
            );
          });
      } finally {
        await prisma.content.delete({ where: { id: draft.id } });
      }
    });

    it('不存在内容 404', () => {
      return request(server())
        .post(
          '/admin/v1/contents/00000000-0000-4000-8000-00000000abcd/actions/unlist',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('NOT_FOUND');
        });
    });
  });

  describe('GET /admin/v1/contents/queues/suspicious', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;
    let suspiciousContentId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-sus-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;

      const row = await prisma.content.create({
        data: {
          publishStatus: 'SUSPICIOUS_PUBLISHED',
          listingState: 'NORMAL',
          title: 'e2e-suspicious-queue',
        },
      });
      suspiciousContentId = row.id;
    });

    afterEach(async () => {
      if (suspiciousContentId) {
        await prisma.content.deleteMany({
          where: { id: suspiciousContentId },
        });
        suspiciousContentId = '';
      }
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('无 Authorization 时 401', () => {
      return request(server())
        .get('/admin/v1/contents/queues/suspicious')
        .expect(401)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('ADMIN_AUTH_REQUIRED');
        });
    });

    it('返回疑似已发布内容分页', async () => {
      const res = await request(server())
        .get('/admin/v1/contents/queues/suspicious?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as ApiSuccess<{
        items: Array<{
          id: string;
          publishStatus: string;
          title: string | null;
          entitlementId: string | null;
        }>;
        total: number;
        page: number;
        pageSize: number;
      }>;
      expect(body.success).toBe(true);
      expect(body.data.total).toBeGreaterThanOrEqual(1);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(10);
      const hit = body.data.items.find((i) => i.id === suspiciousContentId);
      expect(hit).toBeDefined();
      expect(hit!.publishStatus).toBe('SUSPICIOUS_PUBLISHED');
      expect(hit!.title).toBe('e2e-suspicious-queue');
      expect(hit!.entitlementId).toBeNull();
    });

    it('队列项含 entitlementId（与权益 1:1 绑定）', async () => {
      const c = await request(server())
        .post('/admin/v1/content-entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'sus-ent' })
        .expect(201);
      const { entitlementId, contentId } = (
        c.body as ApiSuccess<{ entitlementId: string; contentId: string }>
      ).data;
      await prisma.content.update({
        where: { id: contentId },
        data: {
          publishStatus: 'SUSPICIOUS_PUBLISHED',
          listingState: 'NORMAL',
        },
      });
      try {
        const res = await request(server())
          .get('/admin/v1/contents/queues/suspicious?page=1&pageSize=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          items: Array<{ id: string; entitlementId: string | null }>;
        }>;
        const hit = body.data.items.find((i) => i.id === contentId);
        expect(hit).toBeDefined();
        expect(hit!.entitlementId).toBe(entitlementId);
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [{ targetId: contentId }, { targetId: entitlementId }],
          },
        });
        await prisma.content.deleteMany({ where: { id: contentId } });
      }
    });
  });

  describe('POST /admin/v1/contents/:id/actions/clear-suspicion|mark-manually-rejected', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-sr-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;
    });

    afterEach(async () => {
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('clear-suspicion：SUSPICIOUS_PUBLISHED → PUBLISHED 并写审计', async () => {
      const row = await prisma.content.create({
        data: {
          publishStatus: 'SUSPICIOUS_PUBLISHED',
          listingState: 'NORMAL',
          title: 'sr-clear',
        },
      });
      try {
        const res = await request(server())
          .post(`/admin/v1/contents/${row.id}/actions/clear-suspicion`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(
          (res.body as ApiSuccess<{ publishStatus: string }>).data
            .publishStatus,
        ).toBe('PUBLISHED');
        const aud = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.PLATFORM_CONTENT_SUSPICION_CLEARED,
            targetId: row.id,
          },
        });
        expect(aud).not.toBeNull();
        expect(aud!.actorUserId).toBe(adminUserId);
      } finally {
        await prisma.auditLog.deleteMany({ where: { targetId: row.id } });
        await prisma.content.delete({ where: { id: row.id } });
      }
    });

    it('mark-manually-rejected：SUSPICIOUS_PUBLISHED → MANUALLY_REJECTED 并写审计', async () => {
      const row = await prisma.content.create({
        data: {
          publishStatus: 'SUSPICIOUS_PUBLISHED',
          listingState: 'NORMAL',
          title: 'sr-rej',
        },
      });
      try {
        const res = await request(server())
          .post(`/admin/v1/contents/${row.id}/actions/mark-manually-rejected`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(
          (res.body as ApiSuccess<{ publishStatus: string }>).data
            .publishStatus,
        ).toBe('MANUALLY_REJECTED');
        const aud = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.PLATFORM_CONTENT_MANUAL_REJECT,
            targetId: row.id,
          },
        });
        expect(aud).not.toBeNull();
        expect(aud!.actorUserId).toBe(adminUserId);
      } finally {
        await prisma.auditLog.deleteMany({ where: { targetId: row.id } });
        await prisma.content.delete({ where: { id: row.id } });
      }
    });

    it('clear-suspicion：非疑似态 409', async () => {
      const row = await prisma.content.create({
        data: {
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
        },
      });
      try {
        await request(server())
          .post(`/admin/v1/contents/${row.id}/actions/clear-suspicion`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409)
          .expect((res: Response) => {
            const body = res.body as ApiFailure;
            expect(body.error.code).toBe(
              'CONTENT_PLATFORM_SUSPICION_RESOLUTION_INVALID_STATE',
            );
          });
      } finally {
        await prisma.content.delete({ where: { id: row.id } });
      }
    });
  });

  describe('GET /admin/v1/contents/:contentId', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-get-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;
    });

    afterEach(async () => {
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('无 Authorization 时 401', () => {
      return request(server())
        .get(`/admin/v1/contents/${randomUUID()}`)
        .expect(401);
    });

    it('非法 id 形态 404', () => {
      return request(server())
        .get('/admin/v1/contents/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('NOT_FOUND');
        });
    });

    it('存在内容 200 含正文', async () => {
      const row = await prisma.content.create({
        data: {
          title: 'adm-detail',
          body: { blocks: [] },
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        const res = await request(server())
          .get(`/admin/v1/contents/${row.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          id: string;
          title: string | null;
          body: unknown;
          publishStatus: string;
          entitlementId: string | null;
          redemptionCodeCount: number;
          redemptionCodes: unknown[];
          entitlement: null;
        }>;
        expect(body.data.id).toBe(row.id);
        expect(body.data.title).toBe('adm-detail');
        expect(body.data.publishStatus).toBe('DRAFT');
        expect(body.data.body).toEqual({ blocks: [] });
        expect(body.data.entitlementId).toBeNull();
        expect(body.data.redemptionCodeCount).toBe(0);
        expect(body.data.redemptionCodes).toEqual([]);
        expect(body.data.entitlement).toBeNull();
      } finally {
        await prisma.content.delete({ where: { id: row.id } });
      }
    });

    it('绑定权益时返回 entitlementId', async () => {
      const c = await request(server())
        .post('/admin/v1/content-entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'ent-bound' })
        .expect(201);
      const { entitlementId, contentId, redemptionCodeId } = (
        c.body as ApiSuccess<{
          entitlementId: string;
          contentId: string;
          redemptionCodeId: string;
        }>
      ).data;
      try {
        const res = await request(server())
          .get(`/admin/v1/contents/${contentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          entitlementId: string | null;
          redemptionCodeCount: number;
          redemptionCodes: Array<{ id: string }>;
          entitlement: {
            id: string;
            contentId: string;
            status: string;
            redemptionCodeCount: number;
          } | null;
        }>;
        expect(body.data.entitlementId).toBe(entitlementId);
        expect(body.data.redemptionCodeCount).toBeGreaterThanOrEqual(1);
        expect(body.data.redemptionCodes.length).toBeGreaterThanOrEqual(1);
        expect(body.data.entitlement?.id).toBe(entitlementId);
        expect(body.data.entitlement?.contentId).toBe(contentId);
        expect(body.data.entitlement?.status).toBe('ACTIVE');
        expect(body.data.entitlement?.redemptionCodeCount).toBe(
          body.data.redemptionCodeCount,
        );
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { targetId: contentId },
              { targetId: entitlementId },
              { targetId: redemptionCodeId },
            ],
          },
        });
        await prisma.content.deleteMany({ where: { id: contentId } });
      }
    });

    it('内容列表返回兑换码明文且不暴露 hash', async () => {
      const listPlain = `LIST-${randomUUID()}`;
      const c = await request(server())
        .post('/admin/v1/content-entitlements/redemption-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'list-code', plainCode: listPlain })
        .expect(201);
      const { contentId, entitlementId, redemptionCodeId } = (
        c.body as ApiSuccess<{
          contentId: string;
          entitlementId: string;
          redemptionCodeId: string;
        }>
      ).data;
      try {
        const res = await request(server())
          .get('/admin/v1/contents?page=1&pageSize=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          items: Array<{
            id: string;
            entitlementId: string | null;
            redemptionCodeCount: number;
            redemptionCodes: Array<{
              id: string;
              status: string;
              codeHash?: string;
              plainCode?: string;
            }>;
            entitlement: {
              id: string;
              contentId: string;
              status: string;
              redemptionCodeCount: number;
              redemptionCodes: Array<{ id: string; plainCode?: string }>;
            } | null;
          }>;
        }>;
        const hit = body.data.items.find((item) => item.id === contentId);
        expect(hit?.entitlementId).toBe(entitlementId);
        expect(hit?.redemptionCodeCount).toBe(1);
        expect(hit?.redemptionCodes[0]?.id).toBe(redemptionCodeId);
        expect(hit?.redemptionCodes[0]?.status).toBe('ACTIVE');
        expect(hit?.redemptionCodes[0]?.plainCode).toBe(listPlain);
        expect(hit?.redemptionCodes[0]?.codeHash).toBeUndefined();
        expect(hit?.entitlement?.id).toBe(entitlementId);
        expect(hit?.entitlement?.contentId).toBe(contentId);
        expect(hit?.entitlement?.status).toBe('ACTIVE');
        expect(hit?.entitlement?.redemptionCodeCount).toBe(1);
        expect(hit?.entitlement?.redemptionCodes[0]?.plainCode).toBe(listPlain);
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { targetId: contentId },
              { targetId: entitlementId },
              { targetId: redemptionCodeId },
            ],
          },
        });
        await prisma.content.deleteMany({ where: { id: contentId } });
      }
    });

    it('GET /admin/v1/contents 支持 publishStatus 筛选', async () => {
      const row = await prisma.content.create({
        data: {
          title: 'list-filter-draft',
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        const filtered = await request(server())
          .get('/admin/v1/contents?page=1&pageSize=100&publishStatus=PUBLISHED')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = filtered.body as ApiSuccess<{
          items: Array<{ id: string; publishStatus: string }>;
        }>;
        expect(
          body.data.items.every((i) => i.publishStatus === 'PUBLISHED'),
        ).toBe(true);
        expect(body.data.items.some((i) => i.id === row.id)).toBe(false);
      } finally {
        await prisma.content.deleteMany({ where: { id: row.id } });
      }
    });

    it('PATCH permissions 可编辑发布态与上架态并写审计', async () => {
      const row = await prisma.content.create({
        data: {
          title: 'perm-edit',
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        const res = await request(server())
          .patch(`/admin/v1/contents/${row.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            publishStatus: 'PUBLISHED',
            listingState: 'PLATFORM_UNLISTED',
          })
          .expect(200);
        const body = res.body as ApiSuccess<{
          publishStatus: string;
          listingState: string;
        }>;
        expect(body.data.publishStatus).toBe('PUBLISHED');
        expect(body.data.listingState).toBe('PLATFORM_UNLISTED');
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.PLATFORM_CONTENT_PERMISSION_UPDATE,
            targetId: row.id,
          },
        });
        expect(audit).not.toBeNull();
        expect(audit!.actorUserId).toBe(adminUserId);
      } finally {
        await prisma.auditLog.deleteMany({ where: { targetId: row.id } });
        await prisma.content.deleteMany({ where: { id: row.id } });
      }
    });

    it('管理员可从内容列表发起内容审核', async () => {
      const row = await prisma.content.create({
        data: {
          title: 'submit-moderation',
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        const res = await request(server())
          .post(`/admin/v1/contents/${row.id}/actions/submit-moderation`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(200);
        const body = res.body as ApiSuccess<{ publishStatus: string }>;
        expect(body.data.publishStatus).toBe('SUBMITTED');
        const job = await prisma.moderationJob.findFirst({
          where: { contentId: row.id },
        });
        expect(job?.state).toBe('QUEUED');
        const audit = await prisma.auditLog.findFirst({
          where: {
            action: AuditAction.PLATFORM_CONTENT_SUBMIT_MODERATION,
            targetId: row.id,
          },
        });
        expect(audit?.actorUserId).toBe(adminUserId);
      } finally {
        await prisma.auditLog.deleteMany({ where: { targetId: row.id } });
        await prisma.moderationJob.deleteMany({ where: { contentId: row.id } });
        await prisma.content.deleteMany({ where: { id: row.id } });
      }
    });
  });

  describe('GET /admin/v1/contents/:contentId/transfer-records', () => {
    let prisma: PrismaService;
    let adminToken: string;
    let adminUserId: string;

    beforeEach(async () => {
      prisma = app.get(PrismaService);
      const email = `adm-tr-${randomUUID()}@x.test`;
      const password = 'AdminPass11!!';
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          platformAdmin: true,
        },
      });
      adminUserId = user.id;
      const loginRes = await request(server())
        .post('/admin/v1/auth/login')
        .send({ email, password })
        .expect(200);
      adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
        .accessToken;
    });

    afterEach(async () => {
      if (adminUserId) {
        await prisma.auditLog.deleteMany({
          where: { actorUserId: adminUserId },
        });
        await prisma.user.deleteMany({ where: { id: adminUserId } });
        adminUserId = '';
      }
    });

    it('无 Authorization 时 401', () => {
      return request(server())
        .get(`/admin/v1/contents/${randomUUID()}/transfer-records`)
        .expect(401);
    });

    it('非法 id 形态 404', () => {
      return request(server())
        .get('/admin/v1/contents/not-a-uuid/transfer-records')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('NOT_FOUND');
        });
    });

    it('内容不存在 404', () => {
      return request(server())
        .get(
          `/admin/v1/contents/00000000-0000-4000-8000-00000000abcd/transfer-records`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('NOT_FOUND');
        });
    });

    it('无转让单时 total 为 0', async () => {
      const row = await prisma.content.create({
        data: {
          publishStatus: 'DRAFT',
          listingState: 'NORMAL',
        },
      });
      try {
        const res = await request(server())
          .get(`/admin/v1/contents/${row.id}/transfer-records`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          items: unknown[];
          total: number;
        }>;
        expect(body.data.items).toEqual([]);
        expect(body.data.total).toBe(0);
      } finally {
        await prisma.content.delete({ where: { id: row.id } });
      }
    });

    it('有转让行时按 createdAt desc 返回', async () => {
      const from = await prisma.memberUser.create({
        data: {
          email: `tr-m-${randomUUID()}@x.test`,
          passwordHash: bcrypt.hashSync('MemberPass11!!', 10),
        },
      });
      const content = await prisma.content.create({
        data: {
          ownerMemberId: from.id,
          publishStatus: 'PUBLISHED',
          listingState: 'NORMAL',
        },
      });
      const t1 = await prisma.contentTransfer.create({
        data: {
          contentId: content.id,
          fromMemberId: from.id,
          method: 'TRANSFER_CODE',
          codeHash: hashRedemptionCode('transfer:e2e-tr-1'),
          status: 'REVOKED',
          expiresAt: new Date('2099-06-01T00:00:00.000Z'),
          revokedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
      const t2 = await prisma.contentTransfer.create({
        data: {
          contentId: content.id,
          fromMemberId: from.id,
          method: 'CARD_SHARE',
          cardTokenHash: hashRedemptionCode('card:e2e-tr-2'),
          status: 'PENDING',
          expiresAt: new Date('2099-07-01T00:00:00.000Z'),
        },
      });
      try {
        const res = await request(server())
          .get(
            `/admin/v1/contents/${content.id}/transfer-records?page=1&pageSize=10`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const body = res.body as ApiSuccess<{
          items: Array<{
            id: string;
            contentId: string;
            fromMemberId: string;
            toMemberId: string | null;
            method: string;
            status: string;
          }>;
          total: number;
          page: number;
          pageSize: number;
        }>;
        expect(body.data.total).toBe(2);
        expect(body.data.page).toBe(1);
        expect(body.data.pageSize).toBe(10);
        expect(body.data.items.map((i) => i.id)).toEqual([t2.id, t1.id]);
        expect(body.data.items[0].method).toBe('CARD_SHARE');
        expect(body.data.items[0].status).toBe('PENDING');
        expect(body.data.items[0].toMemberId).toBeNull();
        expect(body.data.items[1].status).toBe('REVOKED');
      } finally {
        await prisma.contentTransfer.deleteMany({
          where: { contentId: content.id },
        });
        await prisma.content.delete({ where: { id: content.id } });
        await prisma.memberUser.delete({ where: { id: from.id } });
      }
    });
  });
});

describe('Admin menu items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;

  const server = (): Server => app.getHttpServer() as Server;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('admin/v1');
    await app.init();

    prisma = app.get(PrismaService);
    await cleanupMenuRows(prisma);

    const email = `menu-${randomUUID()}@x.test`;
    const password = 'AdminPass11!!';
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        platformAdmin: true,
      },
    });
    adminUserId = user.id;
    const loginRes = await request(server())
      .post('/admin/v1/auth/login')
      .send({ email, password })
      .expect(200);
    adminToken = (loginRes.body as ApiSuccess<AdminAuthTokenPairDto>).data
      .accessToken;
  });

  afterEach(async () => {
    await cleanupMenuRows(prisma);
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminUserId } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
    await app.close();
  });

  it('无 Authorization 时 401', () => {
    return request(server()).get('/admin/v1/menu-items').expect(401);
  });

  it('非 platformAdmin 访问时 403', async () => {
    const jwt = app.get(JwtService);
    const user = await prisma.user.create({
      data: { email: `menu-non-${randomUUID()}@x.test`, platformAdmin: false },
    });
    try {
      const token = jwt.sign({ sub: user.id });
      await request(server())
        .get('/admin/v1/menu-items')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect((res: Response) => {
          const body = res.body as ApiFailure;
          expect(body.error.code).toBe('ADMIN_FORBIDDEN');
        });
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('创建、禁用、树查询、删除菜单项', async () => {
    const groupRes = await request(server())
      .post('/admin/v1/menu-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'E2E菜单分组', sortOrder: 900 })
      .expect(201);
    const group = (groupRes.body as ApiSuccess<{ id: string }>).data;

    const childRes = await request(server())
      .post('/admin/v1/menu-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        parentId: group.id,
        title: 'E2E菜单会话',
        routePath: '/chats',
        iconKey: 'Menu',
        sortOrder: 10,
      })
      .expect(201);
    const child = (childRes.body as ApiSuccess<{ id: string }>).data;

    const tree = await request(server())
      .get('/admin/v1/menu-items/tree')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const treeBody = tree.body as ApiSuccess<
      Array<{ id: string; children: Array<{ id: string }> }>
    >;
    expect(
      treeBody.data
        .find((item) => item.id === group.id)
        ?.children.some((item) => item.id === child.id),
    ).toBe(true);

    await request(server())
      .patch(`/admin/v1/menu-items/${child.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false })
      .expect(200);

    const disabledTree = await request(server())
      .get('/admin/v1/menu-items/tree')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const disabledTreeBody = disabledTree.body as ApiSuccess<
      Array<{ id: string; children: Array<{ id: string }> }>
    >;
    expect(
      disabledTreeBody.data
        .find((item) => item.id === group.id)
        ?.children.some((item) => item.id === child.id),
    ).toBe(false);

    await request(server())
      .delete(`/admin/v1/menu-items/${group.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect((res: Response) => {
        const body = res.body as ApiFailure;
        expect(body.error.code).toBe('ADMIN_MENU_DELETE_HAS_CHILDREN');
      });

    await request(server())
      .delete(`/admin/v1/menu-items/${child.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(server())
      .delete(`/admin/v1/menu-items/${group.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('允许自定义链接并支持根分组排序', async () => {
    const customGroup = (
      await request(server())
        .post('/admin/v1/menu-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E菜单自定义分组', sortOrder: 905 })
        .expect(201)
    ).body as ApiSuccess<{ id: string }>;

    const customLink = await request(server())
      .post('/admin/v1/menu-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        parentId: customGroup.data.id,
        title: 'E2E菜单自定义链接',
        routePath: 'https://example.com/admin-help',
      })
      .expect(201);
    expect(
      (customLink.body as ApiSuccess<{ routePath: string }>).data.routePath,
    ).toBe('https://example.com/admin-help');

    const first = (
      await request(server())
        .post('/admin/v1/menu-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E菜单排序A', sortOrder: 910 })
        .expect(201)
    ).body as ApiSuccess<{ id: string }>;
    const second = (
      await request(server())
        .post('/admin/v1/menu-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E菜单排序B', sortOrder: 920 })
        .expect(201)
    ).body as ApiSuccess<{ id: string }>;

    const reordered = await request(server())
      .patch('/admin/v1/menu-items/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: first.data.id, parentId: null, sortOrder: 920 },
          { id: second.data.id, parentId: null, sortOrder: 910 },
        ],
      })
      .expect(200);
    const rows = (reordered.body as ApiSuccess<Array<{ id: string }>>).data;
    expect(rows.findIndex((item) => item.id === second.data.id)).toBeLessThan(
      rows.findIndex((item) => item.id === first.data.id),
    );
  });
});

async function cleanupMenuRows(prisma: PrismaService): Promise<void> {
  await prisma.adminMenuItem.deleteMany({
    where: { title: { startsWith: 'E2E菜单' }, parentId: { not: null } },
  });
  await prisma.adminMenuItem.deleteMany({
    where: { title: { startsWith: 'E2E菜单' } },
  });
}
