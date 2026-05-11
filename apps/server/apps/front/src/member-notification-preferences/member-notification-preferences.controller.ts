import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MemberNotificationPreferencesService,
  type MemberNotificationPreferencesDto,
} from './member-notification-preferences.service';

/**
 * PATCH：两渠道布尔可单独更新，但**至少传一个字段**，避免无意义空请求。
 * 与 GET 默认值（站内开、小程序关）在 Service 对齐。
 */
const patchNotificationPrefsBodySchema = z
  .object({
    channelInApp: z
      .boolean()
      .optional()
      .describe('是否接收应用内通知；与 `channelMiniProgram` 至少传其一。'),
    channelMiniProgram: z
      .boolean()
      .optional()
      .describe('是否接收小程序渠道通知。'),
  })
  .strict()
  .refine(
    (v) => v.channelInApp !== undefined || v.channelMiniProgram !== undefined,
    {
      message: '至少需要提供 channelInApp 或 channelMiniProgram 之一',
      path: ['channelInApp'],
    },
  );

/**
 * DTO：更新会员通知渠道开关；至少提交 `channelInApp` 与 `channelMiniProgram` 之一（见 schema `refine`）。
 */
class PatchNotificationPrefsBodyDto extends createZodDto(
  patchNotificationPrefsBodySchema,
) {}

/**
 * 会员级通知渠道开关：影响后续是否写入站内信、小程序订阅任务等（见业务写入点）。
 */
@ApiTags('MemberNotificationPreferences')
@Controller('member-notification-preferences')
export class MemberNotificationPreferencesController {
  constructor(
    private readonly memberNotificationPreferencesService: MemberNotificationPreferencesService,
  ) {}

  /**
   * 无 DB 行时仍返回默认语义（与 Prisma 默认一致），避免客户端分支「是否首次设置」。
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '读取当前会员通知渠道偏好' })
  /** @param req 当前会员上下文。 */
  get(@Req() req: AuthedRequest): Promise<MemberNotificationPreferencesDto> {
    return this.memberNotificationPreferencesService.get(req.memberId);
  }

  /** upsert 偏好并写审计（与改密分离，同事务规则见 Service）。 */
  @Patch()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '更新通知渠道偏好',
    description: '至少提供 channelInApp 或 channelMiniProgram 之一。',
  })
  /**
   * @param req 当前会员。
   * @param body 渠道开关字段子集；至少一项。
   */
  patch(
    @Req() req: AuthedRequest,
    @Body() body: PatchNotificationPrefsBodyDto,
  ): Promise<MemberNotificationPreferencesDto> {
    return this.memberNotificationPreferencesService.patch(req.memberId, body);
  }
}
