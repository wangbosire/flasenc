import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { offsetPageQuerySchema, zUuidV4Strict } from '@app/http';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import {
  AuditLogsService,
  type AuditLogListResultDto,
} from './audit-logs.service';

/** 审计筛选里 actor 类 id 使用严格 UUID v4，避免宽匹配带来的无效扫描。 */
const uuidV4 = zUuidV4Strict('须为 UUID');

/**
 * 管理端审计列表 query：分页 + 可选动作/目标/actor/时间窗。
 * 所有筛选字段均为可选；未传表示不按该维度过滤（具体语义见 Service SQL）。
 */
const auditLogListQuerySchema = offsetPageQuerySchema.extend({
  action: z
    .string()
    .max(128)
    .optional()
    .describe('按审计动作精确筛选；不传则不过滤。'),
  targetType: z
    .string()
    .max(64)
    .optional()
    .describe('被操作对象类型；不传则不过滤。'),
  targetId: z
    .string()
    .max(64)
    .optional()
    .describe('被操作对象 id；不传则不过滤。'),
  actorUserId: uuidV4
    .optional()
    .describe('平台侧操作者 `users.id`（UUID v4）；不传则不过滤。'),
  actorMemberId: uuidV4
    .optional()
    .describe('会员侧操作者 `MemberUser.id`（UUID v4）；不传则不过滤。'),
  from: z
    .string()
    .max(40)
    .optional()
    .describe('时间窗起点 ISO8601；与 `to` 成对使用更佳。'),
  to: z
    .string()
    .max(40)
    .optional()
    .describe('时间窗终点 ISO8601。'),
});

/**
 * DTO：审计日志列表 query（分页 + 可选 action/target/actor/时间窗）。
 * 各筛选字段均为可选；与 {@link AuditLogsService.list} 查询语义一致。
 */
class AuditLogListQueryDto extends createZodDto(auditLogListQuerySchema) {}

/**
 * 审计只读检索：满足 PRD 最小运营能力；结果集可能较大，务必依赖分页。
 */
@ApiTags('AuditLogs')
@Controller('audit-logs')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth('bearer')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /** 将已校验 query 透传给 Service，排序默认按时间倒序（见实现）。 */
  @Get()
  @ApiOperation({ summary: '审计日志分页检索' })
  /**
   * @param query 分页与可选筛选（action、target、actor、时间窗等）；见 schema 各字段 `.describe`。
   */
  list(@Query() query: AuditLogListQueryDto): Promise<AuditLogListResultDto> {
    return this.auditLogsService.list(query);
  }
}
