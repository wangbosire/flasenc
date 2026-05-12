import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { OffsetPageQueryDto } from '@app/http';
import { TransferMethod } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  TransfersService,
  type ContentTransferListResultDto,
  type CreateTransferResultDto,
} from './transfers.service';

/** 发起转让方式：卡片分享或转让码；与 Prisma 枚举一致，避免魔法字符串。 */
const initiateTransferBodySchema = z
  .object({
    method: z
      .nativeEnum(TransferMethod)
      .describe(
        '转让方式：与 Prisma `TransferMethod` 一致（如口令码、卡片分享）。',
      ),
  })
  .strict();

/**
 * DTO：Owner 发起内容转让的请求体（方式：卡片分享或转让码）。
 * 与 Prisma `TransferMethod` 枚举一致，供 OpenAPI 展示枚举值。
 */
class InitiateTransferBodyDto extends createZodDto(
  initiateTransferBodySchema,
) {}

/**
 * 内容维度转让：列表 + 发起。
 *
 * **路由顺序**：在 `FrontModule` 中须排在 `ContentsController` 的 **`GET :contentId`** 之前，
 * 否则 `transfers` 段会被当成 `contentId`。
 */
@ApiTags('Transfers')
@Controller('contents')
export class ContentsTransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  /** Owner 查看某内容下历史转让单；分页见 query DTO。 */
  @Get(':contentId/transfers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Owner 分页列出某内容的转让单' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 内容 id。
   * @param req Owner（`memberId`）。
   * @param query 分页参数。
   */
  listContentTransfers(
    @Param('contentId') contentId: string,
    @Req() req: AuthedRequest,
    @Query() query: OffsetPageQueryDto,
  ): Promise<ContentTransferListResultDto> {
    return this.transfersService.listForContentOwner(
      req.memberId,
      contentId,
      query,
    );
  }

  /**
   * 创建 `PENDING` 转让单：写 `expiresAt`（上海第 7 自然日规则）、生成码/hash 或卡片 token hash；
   * **同一内容仅允许一笔 PENDING** 由 Service + DB 保证。
   */
  @Post(':contentId/transfers')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Owner 发起转让（卡片分享或转让码）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 要发起转让的内容。
   * @param req Owner 上下文。
   * @param body 转让方式枚举。
   */
  initiateTransfer(
    @Param('contentId') contentId: string,
    @Req() req: AuthedRequest,
    @Body() body: InitiateTransferBodyDto,
  ): Promise<CreateTransferResultDto> {
    return this.transfersService.initiateTransfer({
      memberId: req.memberId,
      contentId,
      method: body.method,
    });
  }
}
