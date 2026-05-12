'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

const defaultMysqlUrl =
  'mysql://root:root123..@127.0.0.1:3307/flasenc';

// 标准开发路径使用根目录 compose.yml；在容器内 compose 会注入 DATABASE_URL。
// 将 migrations 应用到当前库；勿对含生产数据且未备份的库随意执行。
const r = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'deploy',
    '--schema=libs/database/prisma/schema.prisma',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? defaultMysqlUrl,
    },
  },
);

process.exit(r.status === null ? 1 : r.status);
