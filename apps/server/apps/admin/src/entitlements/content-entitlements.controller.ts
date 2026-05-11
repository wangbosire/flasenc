import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AdminAuthedRequest } from '../auth/admin-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import { ContentEntitlementsService } from './content-entitlements.service';

/** 创建权益时可选占位标题；不传则由 Service 使用默认或空标题策略。 */
const createEntitlementBodySchema = z.object({
  title: z
    .string()
    .max(512)
    .optional()
    .describe('占位内容可选标题；不传则由 Service 默认。'),
});

/**
 * 生成兑换码时可选自定义明文；不传则服务端随机生成。
 * 响应体中的 `plainCode` **仅出现一次**，落库仅存 hash。
 */
const createRedemptionCodeBodySchema = z.object({
  plainCode: z
    .string()
    .min(4)
    .max(128)
    .optional()
    .describe('自定义明文码；不传则服务端随机生成，仅响应出现一次。'),
});

/** DTO：创建权益及占位内容的请求体（可选标题）。 */
class CreateEntitlementBodyDto extends createZodDto(
  createEntitlementBodySchema,
) {}

/** DTO：为指定权益生成兑换码（可选自定义明文；不传则服务端随机）。 */
class CreateRedemptionCodeBodyDto extends createZodDto(
  createRedemptionCodeBodySchema,
) {}

/**
 * 权益与兑换码：**写操作**全程须 {@link AdminJwtAuthGuard}；`createdByUserId` 取自 JWT `sub`。
 */
@ApiTags('ContentEntitlements')
@Controller('content-entitlements')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth('bearer')
export class ContentEntitlementsController {
  constructor(
    private readonly contentEntitlementsService: ContentEntitlementsService,
  ) {}

  /**
   * 事务内创建 `ContentEntitlement` + 占位 `Content`；审计与幂等规则见 Service。
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建权益并生成占位内容' })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param body 可选占位标题等。
   */
  create(
    @Req() req: AdminAuthedRequest,
    @Body() body: CreateEntitlementBodyDto,
  ): Promise<{ entitlementId: string; contentId: string }> {
    return this.contentEntitlementsService.createEntitlementWithPlaceholder(
      body,
      req.userId,
    );
  }

  /**
   * 在指定权益下新增一条 `RedemptionCode`；`entitlementId` 路径参数须存在且属可操作状态。
   */
  @Post(':entitlementId/redemption-codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '为权益生成兑换码（响应含一次性明文）' })
  @ApiParam({ name: 'entitlementId', description: '权益 UUID' })
  /**
   * @param req 管理端用户。
   * @param entitlementId 目标权益 id。
   * @param body 可选自定义明文码。
   */
  createRedemptionCode(
    @Req() req: AdminAuthedRequest,
    @Param('entitlementId') entitlementId: string,
    @Body() body: CreateRedemptionCodeBodyDto,
  ): Promise<{ plainCode: string; redemptionCodeId: string }> {
    return this.contentEntitlementsService.createRedemptionCode(
      entitlementId,
      body,
      req.userId,
    );
  }
}
