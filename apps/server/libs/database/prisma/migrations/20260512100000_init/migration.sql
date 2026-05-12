-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NULL,
    `password_hash` VARCHAR(255) NULL,
    `platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NULL,
    `password_hash` VARCHAR(255) NULL,
    `display_name` VARCHAR(64) NULL,
    `wechat_mp_open_id` VARCHAR(64) NULL,
    `wechat_union_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `member_users_email_key`(`email`),
    UNIQUE INDEX `member_users_wechat_mp_open_id_key`(`wechat_mp_open_id`),
    UNIQUE INDEX `member_users_wechat_union_id_key`(`wechat_union_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_entitlements` (
    `id` CHAR(36) NOT NULL,
    `content_id` CHAR(36) NOT NULL,
    `created_by_user_id` CHAR(36) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_entitlements_content_id_key`(`content_id`),
    INDEX `content_entitlements_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redemption_codes` (
    `id` CHAR(36) NOT NULL,
    `entitlement_id` CHAR(36) NOT NULL,
    `code_hash` VARCHAR(128) NOT NULL,
    `status` ENUM('ACTIVE', 'INVALIDATED', 'REDEEMED') NOT NULL DEFAULT 'ACTIVE',
    `invalidated_at` DATETIME(3) NULL,
    `redeemed_at` DATETIME(3) NULL,
    `redeemed_by_member_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `redemption_codes_code_hash_key`(`code_hash`),
    INDEX `redemption_codes_entitlement_id_idx`(`entitlement_id`),
    INDEX `redemption_codes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contents` (
    `id` CHAR(36) NOT NULL,
    `owner_member_id` CHAR(36) NULL,
    `placeholder_kind` ENUM('PLACEHOLDER', 'OWNED') NOT NULL DEFAULT 'PLACEHOLDER',
    `title` VARCHAR(512) NULL,
    `body` JSON NULL,
    `publish_status` ENUM('DRAFT', 'SUBMITTED', 'PUBLISHED', 'MACHINE_REJECTED', 'SUSPICIOUS_PUBLISHED', 'MANUALLY_REJECTED') NOT NULL DEFAULT 'DRAFT',
    `listing_state` ENUM('NORMAL', 'PLATFORM_UNLISTED', 'EMERGENCY_HIDDEN') NOT NULL DEFAULT 'NORMAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contents_owner_member_id_idx`(`owner_member_id`),
    INDEX `contents_publish_status_listing_state_idx`(`publish_status`, `listing_state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_templates` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `body` JSON NOT NULL,
    `shelf_status` ENUM('ON_SHELF', 'OFF_SHELF') NOT NULL DEFAULT 'ON_SHELF',
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_templates_shelf_status_deleted_at_idx`(`shelf_status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` CHAR(36) NOT NULL,
    `content_id` CHAR(36) NOT NULL,
    `author_member_id` CHAR(36) NOT NULL,
    `anchor_id` CHAR(36) NULL,
    `parent_id` CHAR(36) NULL,
    `reply_to_comment_id` CHAR(36) NULL,
    `body` JSON NOT NULL,
    `publish_status` ENUM('PENDING', 'PUBLISHED', 'MACHINE_BLOCKED', 'SUSPICIOUS_PUBLISHED', 'DELETED_BY_MODERATION') NOT NULL DEFAULT 'PUBLISHED',
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `comments_content_id_anchor_id_created_at_idx`(`content_id`, `anchor_id`, `created_at`),
    INDEX `comments_author_member_id_idx`(`author_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_transfers` (
    `id` CHAR(36) NOT NULL,
    `content_id` CHAR(36) NOT NULL,
    `from_member_id` CHAR(36) NOT NULL,
    `to_member_id` CHAR(36) NULL,
    `method` ENUM('CARD_SHARE', 'TRANSFER_CODE') NOT NULL,
    `code_hash` VARCHAR(128) NULL,
    `card_token_hash` VARCHAR(128) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `expires_at` DATETIME(3) NOT NULL,
    `confirmed_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_transfers_content_id_status_idx`(`content_id`, `status`),
    INDEX `content_transfers_from_member_id_idx`(`from_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `moderation_jobs` (
    `id` CHAR(36) NOT NULL,
    `subject_type` ENUM('CONTENT', 'COMMENT') NOT NULL,
    `content_id` CHAR(36) NULL,
    `comment_id` CHAR(36) NULL,
    `provider` VARCHAR(64) NOT NULL DEFAULT 'noop',
    `external_job_id` VARCHAR(256) NULL,
    `state` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `result_payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `moderation_jobs_subject_type_state_idx`(`subject_type`, `state`),
    INDEX `moderation_jobs_content_id_idx`(`content_id`),
    INDEX `moderation_jobs_comment_id_idx`(`comment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `actor_member_id` CHAR(36) NULL,
    `action` VARCHAR(128) NOT NULL,
    `target_type` VARCHAR(64) NOT NULL,
    `target_id` VARCHAR(64) NOT NULL,
    `payload` JSON NULL,
    `trace_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_actor_member_id_created_at_idx`(`actor_member_id`, `created_at`),
    INDEX `audit_logs_target_type_target_id_created_at_idx`(`target_type`, `target_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_notification_preferences` (
    `member_id` CHAR(36) NOT NULL,
    `channel_in_app` BOOLEAN NOT NULL DEFAULT true,
    `channel_mini_program` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`member_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `in_app_notifications` (
    `id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `title` VARCHAR(256) NOT NULL,
    `body` VARCHAR(2048) NOT NULL,
    `data` JSON NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `in_app_notifications_member_id_read_at_created_at_idx`(`member_id`, `read_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `content_entitlements` ADD CONSTRAINT `content_entitlements_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_entitlements` ADD CONSTRAINT `content_entitlements_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redemption_codes` ADD CONSTRAINT `redemption_codes_entitlement_id_fkey` FOREIGN KEY (`entitlement_id`) REFERENCES `content_entitlements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redemption_codes` ADD CONSTRAINT `redemption_codes_redeemed_by_member_id_fkey` FOREIGN KEY (`redeemed_by_member_id`) REFERENCES `member_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contents` ADD CONSTRAINT `contents_owner_member_id_fkey` FOREIGN KEY (`owner_member_id`) REFERENCES `member_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_author_member_id_fkey` FOREIGN KEY (`author_member_id`) REFERENCES `member_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_anchor_id_fkey` FOREIGN KEY (`anchor_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_transfers` ADD CONSTRAINT `content_transfers_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_transfers` ADD CONSTRAINT `content_transfers_from_member_id_fkey` FOREIGN KEY (`from_member_id`) REFERENCES `member_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_transfers` ADD CONSTRAINT `content_transfers_to_member_id_fkey` FOREIGN KEY (`to_member_id`) REFERENCES `member_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `moderation_jobs` ADD CONSTRAINT `moderation_jobs_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `moderation_jobs` ADD CONSTRAINT `moderation_jobs_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_member_id_fkey` FOREIGN KEY (`actor_member_id`) REFERENCES `member_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_notification_preferences` ADD CONSTRAINT `member_notification_preferences_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `in_app_notifications` ADD CONSTRAINT `in_app_notifications_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `member_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
