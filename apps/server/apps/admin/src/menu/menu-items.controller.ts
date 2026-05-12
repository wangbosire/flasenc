import {
  Body,
  Controller,
  Delete,
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
import { zUuidChar36 } from '@app/http';
import type { AdminAuthedRequest } from '../auth/admin-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/admin-jwt-auth.guard';
import {
  type AdminMenuItemDto,
  type AdminMenuTreeItemDto,
  MenuItemsService,
} from './menu-items.service';

const nullableRoutePathSchema = z
  .string()
  .min(1)
  .max(512)
  .nullable()
  .optional();
const nullableIconKeySchema = z.string().min(1).max(64).nullable().optional();
const nullableParentIdSchema = zUuidChar36('父级菜单 id 格式无效')
  .nullable()
  .optional();

/** 菜单创建 body：根节点不传链接，叶子节点可绑定任意站内路径或外链。 */
const createMenuItemBodySchema = z
  .object({
    parentId: nullableParentIdSchema.describe(
      '父级菜单 id；不传或为 null 表示创建根分组。',
    ),
    title: z.string().min(1).max(64).describe('菜单展示标题。'),
    routePath: nullableRoutePathSchema.describe(
      '菜单链接；根分组和折叠项传 null 或省略，叶子项可填站内路径或外链。',
    ),
    iconKey: nullableIconKeySchema.describe(
      '前端 lucide 图标映射键；不传或 null 表示无图标。',
    ),
    sortOrder: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .optional()
      .describe('同级排序，越小越靠前；不传默认 0。'),
    enabled: z.boolean().optional().describe('是否启用；不传默认 true。'),
  })
  .strict();

/** 菜单更新 body：只传需要修改的字段。 */
const updateMenuItemBodySchema = z
  .object({
    parentId: nullableParentIdSchema.describe(
      '新父级菜单 id；传 null 表示移动为根分组，不传表示不修改。',
    ),
    title: z.string().min(1).max(64).optional().describe('菜单展示标题。'),
    routePath: nullableRoutePathSchema.describe(
      '菜单链接；传 null 表示清空为分组/折叠项，不传表示不修改。',
    ),
    iconKey: nullableIconKeySchema.describe(
      '前端 lucide 图标映射键；传 null 表示清空，不传表示不修改。',
    ),
    sortOrder: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .optional()
      .describe('同级排序，越小越靠前。'),
    enabled: z.boolean().optional().describe('是否启用。'),
  })
  .strict();

/** 菜单批量排序 body：只调整父级和排序，不修改展示字段。 */
const reorderMenuItemsBodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: zUuidChar36('菜单项 id 格式无效').describe('菜单项 id。'),
            parentId: zUuidChar36('父级菜单 id 格式无效')
              .nullable()
              .describe('新父级菜单 id；null 表示根分组。'),
            sortOrder: z
              .number()
              .int()
              .min(-100000)
              .max(100000)
              .describe('新同级排序。'),
          })
          .strict(),
      )
      .min(1)
      .describe('参与调整的菜单项列表。'),
  })
  .strict();

/** DTO：创建菜单项请求体。 */
class CreateMenuItemBodyDto extends createZodDto(createMenuItemBodySchema) {}

/** DTO：更新菜单项请求体。 */
class UpdateMenuItemBodyDto extends createZodDto(updateMenuItemBodySchema) {}

/** DTO：批量调整菜单父子关系和排序请求体。 */
class ReorderMenuItemsBodyDto extends createZodDto(
  reorderMenuItemsBodySchema,
) {}

/** 管理后台菜单配置：仅平台管理员可读写；侧栏树接口只返回启用节点。 */
@ApiTags('MenuItems')
@Controller('menu-items')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth('bearer')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Get()
  @ApiOperation({ summary: '菜单项列表（含禁用项）' })
  /**
   * @param req 管理端用户；由 Guard 保证为 platformAdmin。
   */
  list(@Req() req: AdminAuthedRequest): Promise<AdminMenuItemDto[]> {
    void req;
    return this.menuItemsService.list();
  }

  @Get('tree')
  @ApiOperation({ summary: '启用菜单树' })
  /**
   * @param req 管理端用户；由 Guard 保证为 platformAdmin。
   */
  tree(@Req() req: AdminAuthedRequest): Promise<AdminMenuTreeItemDto[]> {
    void req;
    return this.menuItemsService.tree();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建菜单项' })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param body 菜单项配置字段。
   */
  create(
    @Req() req: AdminAuthedRequest,
    @Body() body: CreateMenuItemBodyDto,
  ): Promise<AdminMenuItemDto> {
    return this.menuItemsService.create(body, req.userId);
  }

  @Patch('reorder')
  @ApiOperation({ summary: '批量调整菜单排序和父级' })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param body 批量调整列表。
   */
  reorder(
    @Req() req: AdminAuthedRequest,
    @Body() body: ReorderMenuItemsBodyDto,
  ): Promise<AdminMenuItemDto[]> {
    return this.menuItemsService.reorder(body, req.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新菜单项' })
  @ApiParam({ name: 'id', description: '菜单项 UUID' })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param id 目标菜单项 id。
   * @param body 待更新字段。
   */
  update(
    @Req() req: AdminAuthedRequest,
    @Param('id') id: string,
    @Body() body: UpdateMenuItemBodyDto,
  ): Promise<AdminMenuItemDto> {
    return this.menuItemsService.update(id, body, req.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除菜单项' })
  @ApiParam({ name: 'id', description: '菜单项 UUID' })
  /**
   * @param req 管理端用户；`userId` 写入审计。
   * @param id 目标菜单项 id；存在子菜单时拒绝删除。
   */
  remove(
    @Req() req: AdminAuthedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    return this.menuItemsService.remove(id, req.userId);
  }
}
