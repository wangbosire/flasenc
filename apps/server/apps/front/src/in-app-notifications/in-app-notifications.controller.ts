import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { createZodDto } from 'nestjs-zod';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  InAppNotificationsService,
  listInAppNotificationsQuerySchema,
  type InAppNotificationItemDto,
  type InAppNotificationListResultDto,
} from './in-app-notifications.service';

/**
 * DTO：站内信列表 query（分页 + 可选仅未读）。
 * Schema 定义在 Service 同文件，在 {@link OffsetPageQueryDto} 上扩展 `onlyUnread`（字符串兼容 querystring）。
 */
class ListInAppNotificationsQueryDto extends createZodDto(
  listInAppNotificationsQuerySchema,
) {}

/**
 * C 端站内信：仅当前登录会员可读；与「通知偏好关闭站内」写入逻辑在 Service 侧配合。
 */
@ApiTags('InAppNotifications')
@Controller('in-app-notifications')
export class InAppNotificationsController {
  constructor(
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  /** 分页 + 可选仅未读；`total` 为符合条件的总行数。 */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '站内信分页列表' })
  /**
   * @param req 当前会员。
   * @param query 分页 + 可选 `onlyUnread`（见 schema `.describe`）。
   */
  list(
    @Req() req: AuthedRequest,
    @Query() query: ListInAppNotificationsQueryDto,
  ): Promise<InAppNotificationListResultDto> {
    return this.inAppNotificationsService.list(req.memberId, query);
  }

  /**
   * 标记已读：**幂等**；非本人通知或不存在走 **404**（与内容只读策略一致，防枚举）。
   */
  @Patch(':notificationId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '标记单条站内信已读（幂等）' })
  @ApiParam({ name: 'notificationId', description: '通知 UUID' })
  /**
   * @param req 当前会员。
   * @param notificationId 要标记已读的通知 id。
   */
  markRead(
    @Req() req: AuthedRequest,
    @Param('notificationId') notificationId: string,
  ): Promise<InAppNotificationItemDto> {
    return this.inAppNotificationsService.markRead(
      req.memberId,
      notificationId,
    );
  }
}
