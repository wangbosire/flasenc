'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

const defaultMysqlUrl =
  'mysql://root:root123..@127.0.0.1:3306/flasenc';

// 本机口令与示例不一致时，在 apps/server/.env 设置 DATABASE_URL；本地标准路径不依赖 Docker。
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
