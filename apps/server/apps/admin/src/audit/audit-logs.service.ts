import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { DomainHttpException, prismaSkipTake } from '@app/http';

/**
 * **Query DTO（Service 层）**：审计列表筛选 + 分页；与 Controller 内 Zod schema 语义对齐，供 `list` 构建 Prisma `where`。
 */
export type AuditLogListQuery = {
  /** 页码，从 1 起。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
  /** 按动作枚举/字符串精确筛选（与落库 `action` 一致）。 */
  action?: string | undefined;
  /** 目标类型（如资源表名或领域前缀）。 */
  targetType?: string | undefined;
  /** 目标实体 id。 */
  targetId?: string | undefined;
  /** 平台用户侧操作者 `users.id`。 */
  actorUserId?: string | undefined;
  /** 会员侧操作者 `MemberUser.id`。 */
  actorMemberId?: string | undefined;
  /** 时间窗起点 ISO8601（含）。 */
  from?: string | undefined;
  /** 时间窗终点 ISO8601（含）。 */
  to?: string | undefined;
};

/** **输出 DTO**：单条审计记录（多态 target + 可选 payload/trace）。 */
export type AuditLogListItemDto = {
  /** `audit_logs.id`。 */
  id: string;
  /** 平台用户操作者；非平台触发为 `null`。 */
  actorUserId: string | null;
  /** 会员操作者；非会员触发为 `null`。 */
  actorMemberId: string | null;
  /** 审计动作标识。 */
  action: string;
  /** 被操作对象类型。 */
  targetType: string;
  /** 被操作对象 id。 */
  targetId: string;
  /** 结构化附加上下文（形状依动作而定）。 */
  payload: unknown;
  /** 分布式追踪 id；无则 `null`。 */
  traceId: string | null;
  /** 写入时间 ISO8601。 */
  createdAt: string;
};

/** **输出 DTO**：审计分页列表。 */
export type AuditLogListResultDto = {
  /** 当前页审计行。 */
  items: AuditLogListItemDto[];
  /** 命中筛选的总行数。 */
  total: number;
  /** 当前页码。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogListQuery): Promise<AuditLogListResultDto> {
    const { page, pageSize } = query;
    const where = this.buildWhere(query);
    const { skip, take } = prismaSkipTake(page, pageSize);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorMemberId: r.actorMemberId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        payload: r.payload,
        traceId: r.traceId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  private buildWhere(query: AuditLogListQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action !== undefined && query.action !== '') {
      where.action = query.action;
    }
    if (query.targetType !== undefined && query.targetType !== '') {
      where.targetType = query.targetType;
    }
    if (query.targetId !== undefined && query.targetId !== '') {
      where.targetId = query.targetId;
    }
    if (query.actorUserId !== undefined && query.actorUserId !== '') {
      where.actorUserId = query.actorUserId;
    }
    if (query.actorMemberId !== undefined && query.actorMemberId !== '') {
      where.actorMemberId = query.actorMemberId;
    }

    const from = this.parseIsoBoundary(query.from, 'from');
    const to = this.parseIsoBoundary(query.to, 'to');
    if (from !== undefined || to !== undefined) {
      where.createdAt = {};
      if (from !== undefined) {
        where.createdAt.gte = from;
      }
      if (to !== undefined) {
        where.createdAt.lte = to;
      }
    }

    return where;
  }

  /** `from` / `to` 为 ISO8601 字符串；`to` 按当日含终点的语义由调用方传 **23:59:59.999Z** 或等价。 */
  private parseIsoBoundary(
    raw: string | undefined,
    field: 'from' | 'to',
  ): Date | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new DomainHttpException(
        422,
        'VALIDATION_FAILED',
        `查询参数 ${field} 不是合法日期时间`,
        { field },
      );
    }
    return d;
  }
}
