import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { readRequestTraceId } from '@app/shared';

/** 审计 `action` 约定：全大写 + 点分层，便于检索与前后端对齐（PRD 第 13.2 节清单）。 */
export const AuditAction = {
  MEMBER_REGISTER: 'MEMBER_REGISTER',
  /** 注册失败（当前仅邮箱唯一冲突）；`targetId` 为邮箱哈希，不落明文。 */
  MEMBER_REGISTER_FAILURE: 'MEMBER_REGISTER_FAILURE',
  MEMBER_LOGIN_SUCCESS: 'MEMBER_LOGIN_SUCCESS',
  MEMBER_LOGIN_FAILURE: 'MEMBER_LOGIN_FAILURE',
  /** 会员使用 **`refreshToken`** 换取新 access/refresh 对（双 token 轮换）。 */
  MEMBER_AUTH_REFRESH: 'MEMBER_AUTH_REFRESH',
  /** 会员在已登录会话下修改登录密码（`PATCH /api/v1/auth/me`）。 */
  MEMBER_PASSWORD_CHANGE: 'MEMBER_PASSWORD_CHANGE',
  /** 会员更新评论等通知渠道偏好（`PATCH /api/v1/member-notification-preferences`）。 */
  MEMBER_NOTIFICATION_PREFERENCE_UPDATE:
    'MEMBER_NOTIFICATION_PREFERENCE_UPDATE',
  /** 会员更新展示昵称（`PATCH /api/v1/auth/me` 的 `displayName`）。 */
  MEMBER_PROFILE_UPDATE: 'MEMBER_PROFILE_UPDATE',
  ADMIN_LOGIN_SUCCESS: 'ADMIN_LOGIN_SUCCESS',
  ADMIN_LOGIN_FAILURE: 'ADMIN_LOGIN_FAILURE',
  /** 平台管理员 **`refreshToken`** 轮换。 */
  ADMIN_AUTH_REFRESH: 'ADMIN_AUTH_REFRESH',
  CONTENT_ENTITLEMENT_CREATE: 'CONTENT_ENTITLEMENT_CREATE',
  REDEMPTION_CODE_CREATE: 'REDEMPTION_CODE_CREATE',
  CONTENT_REDEEM_SUCCESS: 'CONTENT_REDEEM_SUCCESS',
  /** 兑换失败（码不存在 / 已失效 / 已使用等）；`payload.errorCode` 与 HTTP `error.code` 对齐。 */
  CONTENT_REDEEM_FAILURE: 'CONTENT_REDEEM_FAILURE',
  CONTENT_OWNER_PATCH: 'CONTENT_OWNER_PATCH',
  CONTENT_OWNER_SUBMIT_PUBLISH: 'CONTENT_OWNER_SUBMIT_PUBLISH',
  /** C 端在可见内容下发表评论（锚点或串内）。 */
  CONTENT_COMMENT_CREATE: 'CONTENT_COMMENT_CREATE',
  /** C 端作者或 Owner 软删评论（`deletedAt`）。 */
  CONTENT_COMMENT_DELETE: 'CONTENT_COMMENT_DELETE',
  /** Owner 发起内容转让（`content_transfers`）。 */
  CONTENT_TRANSFER_CREATE: 'CONTENT_TRANSFER_CREATE',
  /** Owner 撤销待确认转让。 */
  CONTENT_TRANSFER_REVOKE: 'CONTENT_TRANSFER_REVOKE',
  /** 受让人凭码/卡片凭证确认转让。 */
  CONTENT_TRANSFER_CONFIRM: 'CONTENT_TRANSFER_CONFIRM',
  /** 定时任务将过期 **`PENDING`** 置为 **`EXPIRED`**（`actor*` 为空）。 */
  CONTENT_TRANSFER_EXPIRE_JOB: 'CONTENT_TRANSFER_EXPIRE_JOB',
  /** 机审 worker 写入终态（与 Owner 的 `CONTENT_OWNER_SUBMIT_PUBLISH` 区分）；`actor*` 为空表示非人类会话。 */
  CONTENT_MODERATION_OUTCOME: 'CONTENT_MODERATION_OUTCOME',
  PLATFORM_CONTENT_UNLIST: 'PLATFORM_CONTENT_UNLIST',
  PLATFORM_CONTENT_HIDE: 'PLATFORM_CONTENT_HIDE',
  PLATFORM_CONTENT_RESTORE_LISTING: 'PLATFORM_CONTENT_RESTORE_LISTING',
  /** 平台将「疑似已发布」人工确认为正常已发布（`SUSPICIOUS_PUBLISHED`→`PUBLISHED`）。 */
  PLATFORM_CONTENT_SUSPICION_CLEARED: 'PLATFORM_CONTENT_SUSPICION_CLEARED',
  /** 平台对「疑似已发布」人工标记失败，Owner 可再编再提（→`MANUALLY_REJECTED`）。 */
  PLATFORM_CONTENT_MANUAL_REJECT: 'PLATFORM_CONTENT_MANUAL_REJECT',
} as const;

/** 与 Prisma 事务客户端 / 根客户端均可执行 `auditLog.create` 的最小形状。 */
export type AuditLogDelegate = Pick<PrismaClient, 'auditLog'>;

export type AppendAuditLogRow = {
  actorUserId?: string | null;
  actorMemberId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload?: Prisma.InputJsonValue;
  /** 已归一化的追踪 ID，或 `undefined`/`null` 表示不落库。 */
  traceId?: string | null;
};

function normalizeAuditTraceId(
  traceId: string | null | undefined,
): string | undefined {
  if (traceId === undefined || traceId === null) {
    return undefined;
  }
  const t = String(traceId).trim();
  return t.length > 0 ? t.slice(0, 64) : undefined;
}

/**
 * 无 HTTP 请求上下文时写入审计（定时任务、队列 worker 等）；**不**读取 `REQUEST`。
 * `traceId` 仅来自 `row.traceId`（归一化后写入或省略）。
 */
export async function appendAuditLogDetached(
  db: AuditLogDelegate,
  row: AppendAuditLogRow,
): Promise<void> {
  const targetId =
    row.targetId.length > 64 ? row.targetId.slice(0, 64) : row.targetId;
  const traceId = normalizeAuditTraceId(row.traceId);

  await db.auditLog.create({
    data: {
      actorUserId: row.actorUserId === undefined ? undefined : row.actorUserId,
      actorMemberId:
        row.actorMemberId === undefined ? undefined : row.actorMemberId,
      action: row.action,
      targetType: row.targetType,
      targetId,
      payload: row.payload ?? undefined,
      traceId,
    },
  });
}

/**
 * PRD 审计表写入；**不**在业务层散落 `prisma.auditLog.create` 字段拼装。
 * **请求作用域**：从当前 HTTP `REQUEST` 读取 `traceId`（由 {@link RequestTraceMiddleware} 与 `X-Request-Id` 对齐）；`row.traceId` 显式传入时优先。
 */
@Injectable({ scope: Scope.REQUEST })
export class AuditLogService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  async append(db: AuditLogDelegate, row: AppendAuditLogRow): Promise<void> {
    const merged =
      normalizeAuditTraceId(row.traceId) ??
      normalizeAuditTraceId(readRequestTraceId(this.request));

    await appendAuditLogDetached(db, { ...row, traceId: merged });
  }
}
