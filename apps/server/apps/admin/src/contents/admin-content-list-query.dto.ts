import {
  ContentListingState,
  ContentPlaceholderKind,
  ContentPublishStatus,
  RedemptionCodeStatus,
} from '@prisma/client';
import { offsetPageQuerySchema, zUuidChar36Optional } from '@app/http';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Query 中空串视为「未传」，便于前端清空筛选项。 */
function queryEmptyToUndefined(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

const optionalBooleanQuerySchema = z.preprocess(
  queryEmptyToUndefined,
  z.enum(['true', 'false']).optional(),
);

/** 管理端内容列表 GET query：分页 + 可选筛选（全部叠加为 AND）。 */
export const adminContentListQuerySchema = offsetPageQuerySchema.extend({
  /** 精确匹配 `contents.id`。 */
  contentId: z
    .preprocess(queryEmptyToUndefined, zUuidChar36Optional('内容 id 格式无效'))
    .describe('精确匹配内容 UUID；不传不限定。'),
  /** 精确匹配发布状态。 */
  publishStatus: z
    .preprocess(
      queryEmptyToUndefined,
      z.nativeEnum(ContentPublishStatus).optional(),
    )
    .describe('精确匹配发布状态；不传不限定。'),
  /** 精确匹配上架态。 */
  listingState: z
    .preprocess(
      queryEmptyToUndefined,
      z.nativeEnum(ContentListingState).optional(),
    )
    .describe('精确匹配上架态；不传不限定。'),
  /** 精确匹配占位种类。 */
  placeholderKind: z
    .preprocess(
      queryEmptyToUndefined,
      z.nativeEnum(ContentPlaceholderKind).optional(),
    )
    .describe('精确匹配占位种类；不传不限定。'),
  /** 精确匹配持有者会员 id。 */
  ownerMemberId: z
    .preprocess(
      queryEmptyToUndefined,
      zUuidChar36Optional('持有者会员 id 格式无效'),
    )
    .describe('精确匹配 Owner `member_users.id`；不传不限定。'),
  /** 精确匹配权益 id（`content_entitlements.id`）。 */
  entitlementId: z
    .preprocess(queryEmptyToUndefined, zUuidChar36Optional('权益 id 格式无效'))
    .describe('精确匹配内容关联权益 id；不传不限定。'),
  /** 标题子串模糊匹配。 */
  titleContains: z
    .preprocess(queryEmptyToUndefined, z.string().max(512).optional())
    .describe('标题包含该子串（`contains`）；不传不限定。'),
  /** 创建时间下限（含）。 */
  createdFrom: z
    .preprocess(
      queryEmptyToUndefined,
      z.string().datetime({ offset: true }).optional(),
    )
    .describe('筛选 `created_at >=` 该时刻；ISO8601；不传不限定。'),
  /** 创建时间上限（含）。 */
  createdTo: z
    .preprocess(
      queryEmptyToUndefined,
      z.string().datetime({ offset: true }).optional(),
    )
    .describe('筛选 `created_at <=` 该时刻；ISO8601；不传不限定。'),
  /** 更新时间下限（含）。 */
  updatedFrom: z
    .preprocess(
      queryEmptyToUndefined,
      z.string().datetime({ offset: true }).optional(),
    )
    .describe('筛选 `updated_at >=` 该时刻；ISO8601；不传不限定。'),
  /** 更新时间上限（含）。 */
  updatedTo: z
    .preprocess(
      queryEmptyToUndefined,
      z.string().datetime({ offset: true }).optional(),
    )
    .describe('筛选 `updated_at <=` 该时刻；ISO8601；不传不限定。'),
  /** 是否已有关联权益行。 */
  hasEntitlement: optionalBooleanQuerySchema
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === 'true',
    )
    .describe(
      '是否已有 `content_entitlements` 行：`true`/`false`；不传不限定。',
    ),
  /** 是否已有持有者（`owner_member_id` 非空）。 */
  hasOwner: optionalBooleanQuerySchema
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === 'true',
    )
    .describe('是否已有 Owner：`true`/`false`；不传不限定。'),
  /** 兑换码明文子串（关联权益下任一码命中即可）。 */
  redemptionPlainContains: z
    .preprocess(queryEmptyToUndefined, z.string().max(128).optional())
    .describe('关联权益下任一兑换码 `plain_code` 包含该子串；不传不限定。'),
  /** 精确匹配兑换码记录 id。 */
  redemptionCodeId: z
    .preprocess(
      queryEmptyToUndefined,
      zUuidChar36Optional('兑换码记录 id 格式无效'),
    )
    .describe(
      '精确匹配关联权益下某条兑换码 `redemption_codes.id`；不传不限定。',
    ),
  /** 关联权益下至少存在该状态的兑换码。 */
  redemptionCodeStatus: z
    .preprocess(
      queryEmptyToUndefined,
      z.nativeEnum(RedemptionCodeStatus).optional(),
    )
    .describe('关联权益下存在至少一条该状态的兑换码；不传不限定。'),
});

/** **DTO**：`GET /admin/v1/contents` 分页与筛选 query（经全局 Zod pipe 校验）。 */
export class AdminContentListQueryDto extends createZodDto(
  adminContentListQuerySchema,
) {}

/** 校验后的管理端内容列表 query 类型（含 `hasEntitlement`/`hasOwner` 布尔解析结果）。 */
export type AdminContentListQuery = z.infer<typeof adminContentListQuerySchema>;
