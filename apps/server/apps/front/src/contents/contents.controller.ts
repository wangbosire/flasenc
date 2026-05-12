import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { OptionalMemberRequest } from '../auth/optional-jwt-auth.guard';
import { ContentsService, type ContentReadDto } from './contents.service';

/**
 * Owner 局部更新：`title` / `body` 至少一项；与占位、草稿、被拒后再编等状态机配合见 Service。
 * `title` 允许显式 `null`（清空标题语义由产品约定，此处只做形状校验）。
 */
const patchContentBodySchema = z
  .object({
    title: z
      .string()
      .max(512)
      .nullable()
      .optional()
      .describe('标题；可传 `null` 清空；与 `body` 至少填一项。'),
    body: z.unknown().optional().describe('正文 JSON；与 `title` 至少填一项。'),
  })
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: '至少需要提供 title 或 body 之一',
    path: ['title'],
  });

/** DTO：Owner 更新内容局部字段（`title` / `body` 至少其一）；对应 `PATCH .../contents/:id`。 */
class PatchContentBodyDto extends createZodDto(patchContentBodySchema) {}

/**
 * C 端内容读写：`GET` 对访客/Owner 可见性分支由 {@link OptionalJwtAuthGuard} 与 Service 共同完成；
 * 写路径必须 {@link JwtAuthGuard} 且校验 Owner。
 */
@ApiTags('Contents')
@Controller('contents')
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  /**
   * 访客：仅已发布且上架正常等；Owner 带 JWT：可读含草稿在内当前态。
   * 不可见统一 **404**，避免枚举他人草稿 id。
   */
  @Get(':contentId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: '按 ID 读取内容',
    description:
      '可选 Bearer：访客仅见已发布且上架正常；Owner 带 JWT 可读当前状态（含草稿）。',
  })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 内容主键。
   * @param req 可选 JWT：`memberId` 存在时按 Owner 规则放宽可读范围。
   */
  getOne(
    @Param('contentId') contentId: string,
    @Req() req: OptionalMemberRequest,
  ): Promise<ContentReadDto> {
    return this.contentsService.getByIdForViewer(contentId, req.memberId);
  }

  /** 仅 Owner，且仅允许编辑的状态集合由 Service 校验（否则业务 4xx）。 */
  @Patch(':contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Owner 更新草稿/被拒内容（title/body）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 待更新的内容 id。
   * @param req Owner 上下文（`memberId`）。
   * @param body 局部字段；至少 `title` 或 `body` 之一。
   */
  patch(
    @Param('contentId') contentId: string,
    @Req() req: AuthedRequest,
    @Body() body: PatchContentBodyDto,
  ): Promise<ContentReadDto> {
    return this.contentsService.patchByOwner({
      memberId: req.memberId,
      contentId,
      patch: body,
    });
  }

  /**
   * 将内容从可编辑态提交至发布流水线：写入机审 job、可能 noop 立即落终态等，**核心状态机在 Service**。
   */
  @Post(':contentId/actions/submit-publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Owner 提交发布（进入机审队列）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 提交发布的内容 id。
   * @param req Owner 上下文。
   */
  submitPublish(
    @Param('contentId') contentId: string,
    @Req() req: AuthedRequest,
  ): Promise<ContentReadDto> {
    return this.contentsService.submitPublishByOwner({
      memberId: req.memberId,
      contentId,
    });
  }
}
