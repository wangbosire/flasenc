-- 在本机 MySQL 上以可建库账号执行一次即可（示例：`mysql -u root -p < scripts/create-flasenc-database.sql`）。
-- 若库已存在则跳过；字符集与 Prisma / docker-compose 侧约定一致。

CREATE DATABASE IF NOT EXISTS `flasenc`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
