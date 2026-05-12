import {
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
import type { AdminAuthedRequest } from '../auth/admin-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import {
  PlatformContentsService,
  type AdminContentTransferRecordsResultDto,
  type PlatformContentAdminDetailDto,
  type PlatformContentListingDto,
  type SuspiciousPublishedQueueResultDto,
} from './platform-contents.service';

/**
 * 平台侧内容运营接口：读队列/详情/转让记录；写处置动作（下架、隐藏、疑似结论等）。
 *
 * **路由注册顺序**（避免动态段吞字面路径）：
 * 1. `GET queues/suspicious` 必须在 **`GET :contentId`** 之前；
 * 2. `GET :contentId/transfer-records` 必须在裸 **`GET :contentId`** 之前。
 */
@ApiTags('PlatformContents')
@Controller('contents')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth('bearer')
export class PlatformContentsController {
  constructor(private readonly platformContents: PlatformContentsService) {}

  /** 列出当前为「疑似已发布」的内容，供人工队列处理。 */
  @Get('queues/suspicious')
  @ApiOperation({ summary: '疑似已发布内容队列（分页）' })
  /** @param query 通用分页 `page` / `pageSize`。 */
  listSuspiciousPublishedQueue(
    @Query() query: OffsetPageQueryDto,
  ): Promise<SuspiciousPublishedQueueResultDto> {
    return this.platformContents.listSuspiciousPublishedQueue(query);
  }

  /** 平台无条件下架：与 `listingState` 正交字段配合，具体前置状态见 Service。 */
  @Post(':contentId/actions/unlist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '平台无条件下架（已发布/疑似已发布）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 目标内容 id。
   * @param req 操作者平台用户（写审计）。
   */
  unlist(
    @Param('contentId') contentId: string,
    @Req() req: AdminAuthedRequest,
  ): Promise<PlatformContentListingDto> {
    return this.platformContents.setPlatformUnlisted(contentId, req.userId);
  }

  /** 紧急隐藏：与 unlist 不同语义，面向应急舆情等场景。 */
  @Post(':contentId/actions/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '紧急隐藏上架内容' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 目标内容 id。
   * @param req 操作者平台用户。
   */
  hide(
    @Param('contentId') contentId: string,
    @Req() req: AdminAuthedRequest,
  ): Promise<PlatformContentListingDto> {
    return this.platformContents.setEmergencyHidden(contentId, req.userId);
  }

  /** 从平台干预态恢复为对外「正常上架」可视策略（幂等）。 */
  @Post(':contentId/actions/restore-listing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复公开上架态（幂等）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 目标内容 id。
   * @param req 操作者平台用户。
   */
  restoreListing(
    @Param('contentId') contentId: string,
    @Req() req: AdminAuthedRequest,
  ): Promise<PlatformContentListingDto> {
    return this.platformContents.restorePublicListing(contentId, req.userId);
  }

  /** 人工确认「无问题」：疑似已发布 → 正常已发布，同事务写审计。 */
  @Post(':contentId/actions/clear-suspicion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '人工确认无问题：疑似 → 正常已发布' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 目标内容 id。
   * @param req 操作者平台用户。
   */
  clearSuspicion(
    @Param('contentId') contentId: string,
    @Req() req: AdminAuthedRequest,
  ): Promise<PlatformContentListingDto> {
    return this.platformContents.clearSuspicion(contentId, req.userId);
  }

  /** 人工驳回：疑似 → 人工拒绝，Owner 侧可再走编辑/提交流程。 */
  @Post(':contentId/actions/mark-manually-rejected')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '人工标记失败：疑似 → 人工拒绝' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 目标内容 id。
   * @param req 操作者平台用户。
   */
  markManuallyRejected(
    @Param('contentId') contentId: string,
    @Req() req: AdminAuthedRequest,
  ): Promise<PlatformContentListingDto> {
    return this.platformContents.markManuallyRejectedFromSuspicion(
      contentId,
      req.userId,
    );
  }

  /** 运营对账：不返回明文码/token，仅结构化 id 与时间线。 */
  @Get(':contentId/transfer-records')
  @ApiOperation({ summary: '按内容分页查询转让记录（运营对账）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /**
   * @param contentId 内容 id。
   * @param query 分页参数。
   */
  listTransferRecords(
    @Param('contentId') contentId: string,
    @Query() query: OffsetPageQueryDto,
  ): Promise<AdminContentTransferRecordsResultDto> {
    return this.platformContents.listTransferRecordsForAdmin(contentId, query);
  }

  /**
   * 平台复核只读：可越过 C 端访客/Owner 可见性，直接读库中任意存在内容（仍须合法 UUID）。
   */
  @Get(':contentId')
  @ApiOperation({ summary: '平台复核只读详情（含 body、entitlementId 等）' })
  @ApiParam({ name: 'contentId', description: '内容 UUID' })
  /** @param contentId 平台只读详情目标内容 id。 */
  getDetail(
    @Param('contentId') contentId: string,
  ): Promise<PlatformContentAdminDetailDto> {
    return this.platformContents.getDetailForPlatform(contentId);
  }
}
