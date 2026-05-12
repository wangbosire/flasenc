-- CreateTable
CREATE TABLE `admin_menu_items` (
    `id` CHAR(36) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `title` VARCHAR(64) NOT NULL,
    `route_path` VARCHAR(128) NULL,
    `icon_key` VARCHAR(64) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_menu_items_route_path_key`(`route_path`),
    INDEX `admin_menu_items_parent_id_sort_order_idx`(`parent_id`, `sort_order`),
    INDEX `admin_menu_items_enabled_sort_order_idx`(`enabled`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_menu_items` ADD CONSTRAINT `admin_menu_items_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `admin_menu_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default admin sidebar entries. These rows only reference registered admin-web routes.
SET @home_group = UUID();
SET @content_group = UUID();
SET @review_group = UUID();
SET @system_group = UUID();
SET @settings_group = UUID();

INSERT INTO `admin_menu_items` (`id`, `parent_id`, `title`, `route_path`, `icon_key`, `sort_order`, `enabled`, `created_at`, `updated_at`) VALUES
(@home_group, NULL, '首页', NULL, NULL, 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @home_group, '数据概览', '/', 'LayoutDashboard', 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(@content_group, NULL, '内容管理', NULL, NULL, 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @content_group, '内容列表', '/contents', 'FileText', 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @content_group, '生成兑换码', '/redemption-codes', 'Newspaper', 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(@review_group, NULL, '审核管理', NULL, NULL, 30, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @review_group, '机审队列', '/tasks', 'ShieldAlert', 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @review_group, '审计日志', '/users', 'ClipboardList', 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(@system_group, NULL, '系统管理', NULL, NULL, 40, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @system_group, '菜单管理', '/system/menus', 'Menu', 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(@settings_group, @system_group, '设置', NULL, 'Settings', 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @settings_group, '资料', '/settings', 'UserCog', 10, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @settings_group, '账号', '/settings/account', 'Wrench', 20, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @settings_group, '外观', '/settings/appearance', 'Palette', 30, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @settings_group, '通知', '/settings/notifications', 'Bell', 40, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @settings_group, '显示', '/settings/display', 'Monitor', 50, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), @system_group, '帮助中心', '/help-center', 'HelpCircle', 30, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
