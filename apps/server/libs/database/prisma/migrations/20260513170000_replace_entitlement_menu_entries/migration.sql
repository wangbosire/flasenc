-- Replace the old entitlement issuance menu with content list and one-step redemption-code generation.
SET @content_group = (
    SELECT `id`
    FROM `admin_menu_items`
    WHERE `parent_id` IS NULL AND `title` = '内容管理'
    LIMIT 1
);

UPDATE `admin_menu_items`
SET
    `title` = '内容列表',
    `route_path` = '/contents',
    `icon_key` = 'FileText',
    `sort_order` = 10,
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `route_path` = '/apps';

INSERT INTO `admin_menu_items` (`id`, `parent_id`, `title`, `route_path`, `icon_key`, `sort_order`, `enabled`, `created_at`, `updated_at`)
SELECT UUID(), @content_group, '生成兑换码', '/redemption-codes', 'Newspaper', 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE @content_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `admin_menu_items`
    WHERE `route_path` = '/redemption-codes'
  );
