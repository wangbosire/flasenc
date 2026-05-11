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
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransfersService } from './transfers.service';

/**
 * 确认转让 body：**二选一** XOR——必须且只能填 `transferCode` 或 `cardToken` 之一。
 * 两者都缺或都填会在 Zod 层 422，避免进入 Service 后再分支爆炸。
 */
const confirmTransferBodySchema = z
  .object({
    transferCode: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe('转让明文口令；与 `cardToken` 二选一。'),
    cardToken: z
      .string()
      .min(1)
      .max(512)
      .optional()
      .describe('卡片分享 token；与 `transferCode` 二选一。'),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasCode = v.transferCode !== undefined;
    const hasCard = v.cardToken !== undefined;
    if (hasCode === hasCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '须且仅能填写 transferCode 或 cardToken 之一',
        path: ['transferCode'],
      });
    }
  });

/**
 * DTO：受让方确认转让的请求体；**二选一**填写 `transferCode` 或 `cardToken`（互斥由 Zod `superRefine` 保证）。
 */
class ConfirmTransferBodyDto extends createZodDto(confirmTransferBodySchema) {}

/**
 * 转让动作：撤销、确认；路径挂在 `transfers` 资源下，与「按内容列表」分离。
 */
@ApiTags('Transfers')
@Controller('transfers')
export class TransferActionsController {
  constructor(private readonly transfersService: TransfersService) {}

  /** 仅发起方、且仅 `PENDING` 可撤销；状态机细节见 Service。 */
  @Post(':transferId/actions/revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '发起方撤销待确认转让' })
  @ApiParam({ name: 'transferId', description: '转让单 UUID' })
  /**
   * @param transferId 待撤销的转让单 id。
   * @param req 发起方会员上下文。
   */
  revoke(
    @Param('transferId') transferId: string,
    @Req() req: AuthedRequest,
  ): Promise<{ ok: true }> {
    return this.transfersService.revokeTransfer({
      memberId: req.memberId,
      transferId,
    });
  }

  /**
   * 非发起方持码/token 确认：成功则 `Content.ownerMemberId` 变更、`CONFIRMED`、写审计。
   * 过期、自确认、错码等错误码与 HTTP 状态以 Service + 规范为准。
   */
  @Post(':transferId/actions/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '非发起方确认转让',
    description: '须且仅能填 transferCode 或 cardToken 之一。',
  })
  @ApiParam({ name: 'transferId', description: '转让单 UUID' })
  /**
   * @param transferId 目标转让单。
   * @param req 确认方（非发起方持码）会员上下文。
   * @param body 口令或卡片 token，**互斥**二选一。
   */
  confirm(
    @Param('transferId') transferId: string,
    @Req() req: AuthedRequest,
    @Body() body: ConfirmTransferBodyDto,
  ): Promise<{ ok: true; contentId: string }> {
    return this.transfersService.confirmTransfer({
      memberId: req.memberId,
      transferId,
      transferCode: body.transferCode,
      cardToken: body.cardToken,
    });
  }
}
