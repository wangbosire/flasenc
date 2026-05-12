import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditLogService, PrismaService } from '@app/database';
import { DomainHttpException, zUuidChar36 } from '@app/http';

const menuItemIdSchema = zUuidChar36('菜单项 id 格式无效');

/** **输入 DTO**：创建菜单项。 */
export type CreateMenuItemDto = {
  /** 父级菜单 id；为空表示创建根分组。 */
  parentId?: string | null | undefined;
  /** 菜单展示标题。 */
  title: string;
  /** 菜单链接；根分组和折叠项为空，可为站内路径或外链。 */
  routePath?: string | null | undefined;
  /** 前端图标映射键；为空则不展示图标。 */
  iconKey?: string | null | undefined;
  /** 同级排序，越小越靠前。 */
  sortOrder?: number | undefined;
  /** 是否启用；省略时默认启用。 */
  enabled?: boolean | undefined;
};

/** **输入 DTO**：更新菜单项。 */
export type UpdateMenuItemDto = {
  /** 新父级菜单 id；`null` 表示移动为根分组。 */
  parentId?: string | null | undefined;
  /** 菜单展示标题。 */
  title?: string | undefined;
  /** 菜单链接；`null` 表示分组/折叠项，可为站内路径或外链。 */
  routePath?: string | null | undefined;
  /** 前端图标映射键；`null` 表示清空。 */
  iconKey?: string | null | undefined;
  /** 同级排序，越小越靠前。 */
  sortOrder?: number | undefined;
  /** 是否启用。 */
  enabled?: boolean | undefined;
};

/** **输入 DTO**：批量调整菜单父子关系和排序。 */
export type ReorderMenuItemsDto = {
  /** 参与调整的菜单项。 */
  items: Array<{
    /** 菜单项 id。 */
    id: string;
    /** 新父级 id；`null` 表示根分组。 */
    parentId: string | null;
    /** 新同级排序。 */
    sortOrder: number;
  }>;
};

/** **输出 DTO**：菜单项扁平行，供管理页编辑使用。 */
export type AdminMenuItemDto = {
  /** 菜单项 id。 */
  id: string;
  /** 父级菜单 id；根分组为 `null`。 */
  parentId: string | null;
  /** 展示标题。 */
  title: string;
  /** 菜单链接；分组/折叠项为 `null`。 */
  routePath: string | null;
  /** 前端图标映射键；无图标为 `null`。 */
  iconKey: string | null;
  /** 同级排序，越小越靠前。 */
  sortOrder: number;
  /** 是否启用。 */
  enabled: boolean;
  /** 创建时间 ISO8601。 */
  createdAt: string;
  /** 更新时间 ISO8601。 */
  updatedAt: string;
};

/** **输出 DTO**：启用菜单树，供侧栏与命令面板渲染。 */
export type AdminMenuTreeItemDto = AdminMenuItemDto & {
  /** 已按 `sortOrder` 排序的子菜单；禁用节点及其子树不返回。 */
  children: AdminMenuTreeItemDto[];
};

type MenuRow = {
  id: string;
  parentId: string | null;
  title: string;
  routePath: string | null;
  iconKey: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VirtualMenuRow = MenuRow & { children: string[] };

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<AdminMenuItemDto[]> {
    const rows = await this.prisma.adminMenuItem.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    });
    return rows.map(mapMenuItem);
  }

  async tree(): Promise<AdminMenuTreeItemDto[]> {
    const rows = await this.prisma.adminMenuItem.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return buildTree(rows.map(mapMenuItem));
  }

  async create(
    dto: CreateMenuItemDto,
    actorUserId: string,
  ): Promise<AdminMenuItemDto> {
    const parentId =
      dto.parentId === undefined || dto.parentId === null
        ? null
        : parseMenuItemId(dto.parentId);
    const routePath = normalizeNullableString(dto.routePath);
    const normalized = normalizeCreate(dto);
    await this.assertCreateOrMoveValid(parentId, routePath);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.adminMenuItem.create({
          data: normalized,
        });
        await this.auditLog.append(tx, {
          actorUserId,
          action: AuditAction.ADMIN_MENU_ITEM_CREATE,
          targetType: 'AdminMenuItem',
          targetId: created.id,
          payload: { title: created.title, routePath: created.routePath },
        });
        return created;
      });
      return mapMenuItem(row);
    } catch (err) {
      throwRouteConflictAsDomain(err);
    }
  }

  async update(
    idRaw: string,
    dto: UpdateMenuItemDto,
    actorUserId: string,
  ): Promise<AdminMenuItemDto> {
    const id = parseMenuItemId(idRaw);
    const current = await this.findExisting(id);
    const normalized = normalizeUpdate(dto);
    const parentId =
      dto.parentId === undefined
        ? current.parentId
        : dto.parentId === null
          ? null
          : parseMenuItemId(dto.parentId);
    const routePath =
      dto.routePath === undefined
        ? current.routePath
        : normalizeNullableString(dto.routePath);
    await this.assertUpdateValid(current, parentId, routePath);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.adminMenuItem.update({
          where: { id },
          data: normalized,
        });
        await this.auditLog.append(tx, {
          actorUserId,
          action: AuditAction.ADMIN_MENU_ITEM_UPDATE,
          targetType: 'AdminMenuItem',
          targetId: id,
          payload: {
            before: mapMenuItem(current),
            after: mapMenuItem(updated),
          },
        });
        return updated;
      });
      return mapMenuItem(row);
    } catch (err) {
      throwRouteConflictAsDomain(err);
    }
  }

  async reorder(
    dto: ReorderMenuItemsDto,
    actorUserId: string,
  ): Promise<AdminMenuItemDto[]> {
    const rows = await this.prisma.adminMenuItem.findMany();
    const byId = new Map(rows.map((row) => [row.id, toVirtualRow(row)]));
    for (const item of dto.items) {
      const existing = byId.get(item.id);
      if (!existing) {
        throwNotFound();
      }
      existing.parentId = item.parentId;
      existing.sortOrder = item.sortOrder;
    }
    validateTopology([...byId.values()]);

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.adminMenuItem.update({
          where: { id: item.id },
          data: { parentId: item.parentId, sortOrder: item.sortOrder },
        });
      }
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.ADMIN_MENU_ITEM_REORDER,
        targetType: 'AdminMenuItem',
        targetId: 'bulk',
        payload: { items: dto.items },
      });
    });

    return this.list();
  }

  async remove(idRaw: string, actorUserId: string): Promise<{ ok: true }> {
    const id = parseMenuItemId(idRaw);
    const current = await this.findExisting(id);
    const children = await this.prisma.adminMenuItem.count({
      where: { parentId: id },
    });
    if (children > 0) {
      throw new DomainHttpException(
        409,
        'ADMIN_MENU_DELETE_HAS_CHILDREN',
        '请先删除或移动子菜单',
        { id },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.adminMenuItem.delete({ where: { id } });
      await this.auditLog.append(tx, {
        actorUserId,
        action: AuditAction.ADMIN_MENU_ITEM_DELETE,
        targetType: 'AdminMenuItem',
        targetId: id,
        payload: { title: current.title, routePath: current.routePath },
      });
    });
    return { ok: true };
  }

  private async findExisting(id: string): Promise<MenuRow> {
    const row = await this.prisma.adminMenuItem.findUnique({ where: { id } });
    if (!row) {
      throwNotFound();
    }
    return row;
  }

  private async assertCreateOrMoveValid(
    parentId: string | null,
    routePath: string | null,
  ): Promise<void> {
    if (parentId === null) {
      if (routePath !== null) {
        throwInvalidStructure('根节点只能作为菜单分组，不能直接绑定路由');
      }
      return;
    }

    const parent = await this.findExisting(parentId);
    const rows = await this.prisma.adminMenuItem.findMany();
    const parentDepth = depthOf(parent.id, rows.map(toVirtualRow));
    if (parent.routePath !== null) {
      throwInvalidStructure('已绑定路由的菜单项不能作为父级');
    }
    if (parentDepth >= 2) {
      throwInvalidStructure('菜单最多支持分组、折叠项、链接三级');
    }
    if (parentDepth === 1 && routePath === null) {
      throwInvalidStructure('折叠项下的子菜单必须绑定链接');
    }
  }

  private async assertUpdateValid(
    current: MenuRow,
    parentId: string | null,
    routePath: string | null,
  ): Promise<void> {
    if (parentId === current.id) {
      throwInvalidStructure('菜单项不能选择自身作为父级');
    }

    const rows = await this.prisma.adminMenuItem.findMany();
    const byId = new Map(rows.map((row) => [row.id, toVirtualRow(row)]));
    const virtual = byId.get(current.id);
    if (!virtual) {
      throwNotFound();
    }
    virtual.parentId = parentId;
    virtual.routePath = routePath;
    validateTopology([...byId.values()]);
  }
}

function normalizeCreate(
  dto: CreateMenuItemDto,
): Prisma.AdminMenuItemCreateInput {
  return {
    parent:
      dto.parentId === undefined || dto.parentId === null
        ? undefined
        : { connect: { id: parseMenuItemId(dto.parentId) } },
    title: dto.title.trim(),
    routePath: normalizeNullableString(dto.routePath),
    iconKey: normalizeNullableString(dto.iconKey),
    sortOrder: dto.sortOrder ?? 0,
    enabled: dto.enabled ?? true,
  };
}

function normalizeUpdate(
  dto: UpdateMenuItemDto,
): Prisma.AdminMenuItemUpdateInput {
  return {
    parent:
      dto.parentId === undefined
        ? undefined
        : dto.parentId === null
          ? { disconnect: true }
          : { connect: { id: parseMenuItemId(dto.parentId) } },
    title: dto.title === undefined ? undefined : dto.title.trim(),
    routePath:
      dto.routePath === undefined
        ? undefined
        : normalizeNullableString(dto.routePath),
    iconKey:
      dto.iconKey === undefined
        ? undefined
        : normalizeNullableString(dto.iconKey),
    sortOrder: dto.sortOrder,
    enabled: dto.enabled,
  };
}

function normalizeNullableString(
  raw: string | null | undefined,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function parseMenuItemId(raw: string): string {
  const parsed = menuItemIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainHttpException(
      422,
      'VALIDATION_FAILED',
      '菜单项 id 格式无效',
      {
        field: 'id',
      },
    );
  }
  return parsed.data;
}

function throwNotFound(): never {
  throw new DomainHttpException(
    404,
    'ADMIN_MENU_ITEM_NOT_FOUND',
    '菜单项不存在',
    {},
  );
}

function throwInvalidStructure(message: string): never {
  throw new DomainHttpException(
    400,
    'ADMIN_MENU_INVALID_STRUCTURE',
    message,
    {},
  );
}

function throwRouteConflictAsDomain(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new DomainHttpException(
      409,
      'ADMIN_MENU_ROUTE_CONFLICT',
      '该路由已被其他菜单项使用',
      {},
    );
  }
  throw err;
}

function mapMenuItem(row: MenuRow): AdminMenuItemDto {
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    routePath: row.routePath,
    iconKey: row.iconKey,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildTree(items: AdminMenuItemDto[]): AdminMenuTreeItemDto[] {
  const byId = new Map<string, AdminMenuTreeItemDto>();
  for (const item of items) {
    byId.set(item.id, { ...item, children: [] });
  }

  const roots: AdminMenuTreeItemDto[] = [];
  for (const item of byId.values()) {
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(item);
    } else if (item.parentId === null) {
      roots.push(item);
    }
  }

  const sort = (nodes: AdminMenuTreeItemDto[]) => {
    nodes.sort(compareMenuItem);
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

function compareMenuItem(a: AdminMenuItemDto, b: AdminMenuItemDto): number {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

function toVirtualRow(row: MenuRow): VirtualMenuRow {
  return { ...row, children: [] };
}

function validateTopology(rows: VirtualMenuRow[]): void {
  const byId = new Map(rows.map((row) => [row.id, row]));
  rows.forEach((row) => {
    row.children = [];
  });
  for (const row of rows) {
    if (row.parentId !== null) {
      const parent = byId.get(row.parentId);
      if (!parent) {
        throw new DomainHttpException(
          404,
          'ADMIN_MENU_PARENT_NOT_FOUND',
          '父级菜单不存在',
          { parentId: row.parentId },
        );
      }
      parent.children.push(row.id);
    }
  }

  for (const row of rows) {
    const depth = depthOf(row.id, rows);
    if (depth > 2) {
      throwInvalidStructure('菜单最多支持分组、折叠项、链接三级');
    }
    if (depth === 0 && row.routePath !== null) {
      throwInvalidStructure('根节点只能作为菜单分组，不能直接绑定路由');
    }
    if (depth === 2 && row.routePath === null) {
      throwInvalidStructure('折叠项下的子菜单必须绑定链接');
    }
    if (row.children.length > 0 && row.routePath !== null) {
      throwInvalidStructure('已绑定路由的菜单项不能拥有子菜单');
    }
  }
}

function depthOf(id: string, rows: VirtualMenuRow[]): number {
  const byId = new Map(rows.map((row) => [row.id, row]));
  let depth = 0;
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current?.parentId) {
    if (seen.has(current.id)) {
      throwInvalidStructure('菜单父子关系不能形成循环');
    }
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) {
      throw new DomainHttpException(
        404,
        'ADMIN_MENU_PARENT_NOT_FOUND',
        '父级菜单不存在',
        { parentId: current.parentId },
      );
    }
    depth += 1;
    current = parent;
  }
  return depth;
}
