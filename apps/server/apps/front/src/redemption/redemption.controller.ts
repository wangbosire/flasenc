import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedemptionService } from './redemption.service';

/** 明文兑换码；服务端优先按库列 **`plain_code`** 精确匹配，旧数据未落库明文时再按 **`code_hash`** 命中（单方摘要，非对称加密）。 */
const redeemBodySchema = z.object({
  code: z
    .string()
    .min(1, '兑换码不能为空')
    .describe(
      '明文兑换码；服务端按明文（必要时哈希兜底）匹配，日志不回显完整码。',
    ),
});

/** DTO：已登录会员提交明文兑换码；校验落在 {@link RedemptionService.redeem}。 */
class RedeemBodyDto extends createZodDto(redeemBodySchema) {}

/**
 * 权益兑换：整类路由挂在根 `Controller()`，故完整路径为 **`POST /api/v1/redemption-codes/actions/redeem`**（随全局前缀）。
 * **必须登录**：`sub` 写入 `redeemedByMemberId` 并更新内容 Owner。
 */
@ApiTags('Redemption')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class RedemptionController {
  constructor(private readonly redemptionService: RedemptionService) {}

  /**
   * 事务内抢码、写审计、改 `Content.ownerMemberId`；并发下依赖 DB 约束保证一码一用（见设计文档）。
   */
  @Post('redemption-codes/actions/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '已登录会员兑换权益码' })
  /**
   * @param req 已登录会员；`memberId` 写入兑换记录。
   * @param body 明文 `code`。
   */
  redeem(
    @Req() req: AuthedRequest,
    @Body() body: RedeemBodyDto,
  ): Promise<{ contentId: string; ownerMemberId: string }> {
    return this.redemptionService.redeem({
      memberId: req.memberId,
      plainCode: body.code,
    });
  }
}
