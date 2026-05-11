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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OffsetPageQueryDto, zUuidChar36Optional } from '@app/http';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { OptionalMemberRequest } from '../auth/optional-jwt-auth.guard';
import {
  CommentsService,
  type CommentListItemDto,
  type CommentListResultDto,
} from './comments.service';

/**
 * 发表评论 body：`body` 为 JSON 载体；`anchorId` / `replyToCommentId` 控制二层对话串。
 * **根评论**：三者皆可空（由 Service 写库规则）；**串内回复**：须满足「parent 恒锚点」等不变量（见 Service）。
 */
const createCommentBodySchema = z
  .object({
    body: z
      .unknown()
      .describe('评论正文 JSON（块结构等与客户端契约一致）。'),
    anchorId: zUuidChar36Optional().describe(
      '对话锚点根评论 id；顶层根评论可省略。',
    ),
    replyToCommentId: zUuidChar36Optional().describe(
      '被直接回复的评论 id；与 `anchorId` 二层串规则见 Service。',
    ),
  })
  .strict()
  .refine((v) => v.body !== undefined, {
    message: 'body 必填',
    path: ['body'],
  });

/**
 * DTO：在某内容下创建评论的请求体（正文 JSON + 可选锚点/回复引用）。
 * 二层对话串不变量由 Service 在写入前再次校验。
 */
class CreateCommentBodyDto extends createZodDto(createCommentBodySchema) {}

/**
 * 评论路由挂在 `contents` 下，以便列表与单条内容共用**可见性**判定（与 Optional JWT 一致）。
 *
 * **Nest 路由顺序**：本控制器在 `FrontModule` 中须排在 `ContentsController` 的 **`GET :contentId`** 之前，
 * 否则 `GET .../comments` 会被 `:contentId` 抢先匹配成「把 comments 当 uuid」。
 */
@ApiTags('Comments')
@Controller('contents')
export class ContentsCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** 分页参数见 {@link OffsetPageQueryDto}；排序与过滤软删在 Service。 */
  @Get(':contentId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: '内容下评论分页列表',
    description: '与内容可见性规则对齐；可选 JWT。',
  })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 所属内容 id（须通过内容可见性校验）。
   * @param req 可选访客/会员上下文。
   * @param query 分页：`page`、`pageSize`（见 {@link OffsetPageQueryDto}）。
   */
  listComments(
    @Param('contentId') contentId: string,
    @Req() req: OptionalMemberRequest,
    @Query() query: OffsetPageQueryDto,
  ): Promise<CommentListResultDto> {
    return this.commentsService.listForViewer(contentId, req.memberId, query);
  }

  /**
   * 创建评论：鉴权后把「锚点 / 回复谁」交给 Service 做二层深度校验，禁止第三层。
   */
  @Post(':contentId/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '发表评论（二层对话串）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 发表评论所属内容。
   * @param req 已登录会员。
   * @param body 正文与可选锚点/回复引用。
   */
  createComment(
    @Param('contentId') contentId: string,
    @Req() req: AuthedRequest,
    @Body() body: CreateCommentBodyDto,
  ): Promise<CommentListItemDto> {
    return this.commentsService.createUnderContent({
      contentId,
      memberId: req.memberId,
      body: body.body,
      anchorId: body.anchorId,
      replyToCommentId: body.replyToCommentId,
    });
  }
}
