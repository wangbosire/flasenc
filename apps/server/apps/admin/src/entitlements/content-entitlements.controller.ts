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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
 * 响应体中的 `plainCode` **仅创建响应强调复制**；库内 **`plain_code`（明文）与 `code_hash`（摘要）同事务写入**，兑换优先按明文列匹配。
 */
const createRedemptionCodeBodySchema = z.object({
  plainCode: z
    .string()
    .min(4)
    .max(128)
    .optional()
    .describe('自定义明文码；不传则服务端随机生成，仅响应出现一次。'),
});

/**
 * 生成兑换码主路径：同时创建占位内容与权益，避免前端两步调用产生半完成数据。
 */
const createRedemptionCodeWithContentBodySchema = z.object({
  title: z
    .string()
    .max(512)
    .optional()
    .describe('占位内容可选标题；不传则内容标题为空。'),
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

/** DTO：创建占位内容、权益并立即生成兑换码。 */
class CreateRedemptionCodeWithContentBodyDto extends createZodDto(
  createRedemptionCodeWithContentBodySchema,
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
   * 事务内创建占位 `Content`、`ContentEntitlement` 与 **唯一一条** `RedemptionCode`；
   * 明文仅响应一次（与同应用的 **`POST …/redemption-codes`** 一体化接口一致）。
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '创建权益、占位内容并生成兑换码（响应含一次性明文）',
  })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param body 可选占位标题等。
   */
  create(
    @Req() req: AdminAuthedRequest,
    @Body() body: CreateEntitlementBodyDto,
  ): Promise<{
    entitlementId: string;
    contentId: string;
    redemptionCodeId: string;
    plainCode: string;
  }> {
    return this.contentEntitlementsService.createEntitlementWithPlaceholder(
      body,
      req.userId,
    );
  }

  /**
   * 一体化生成兑换码：同事务创建占位 Content、ContentEntitlement 与 RedemptionCode。
   */
  @Post('redemption-codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建内容、权益并生成兑换码（响应含一次性明文）' })
  /**
   * @param req 管理端用户；`userId` 写入权益与兑换码审计。
   * @param body 可选内容标题和自定义明文码。
   */
  createRedemptionCodeWithContent(
    @Req() req: AdminAuthedRequest,
    @Body() body: CreateRedemptionCodeWithContentBodyDto,
  ): Promise<{
    entitlementId: string;
    contentId: string;
    redemptionCodeId: string;
    plainCode: string;
  }> {
    return this.contentEntitlementsService.createRedemptionCodeWithContent(
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
