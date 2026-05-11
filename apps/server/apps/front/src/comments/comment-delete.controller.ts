import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';

/**
 * 评论删除独立在 `comments` 路径下（与列表 `contents/.../comments` 分离），便于 REST 语义与权限文案。
 * **软删**：数据库行保留，`deletedAt` 由 Service 写入；列表侧过滤。
 */
@ApiTags('Comments')
@Controller('comments')
export class CommentDeleteController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * 作者或内容 Owner 可删；他人 **403**；已删再删 **404**（与「不可见」策略一致）。
   */
  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '软删评论（作者或内容 Owner）' })
  @ApiParam({ name: 'commentId', description: '评论 UUID' })
  remove(
    @Param('commentId') commentId: string,
    @Req() req: AuthedRequest,
  ): Promise<{ ok: true }> {
    return this.commentsService
      .softDeleteById({ memberId: req.memberId, commentId })
      .then(() => ({ ok: true as const }));
  }
}
