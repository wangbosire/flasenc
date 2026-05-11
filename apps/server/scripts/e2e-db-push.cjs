'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

const defaultMysqlUrl =
  'mysql://root:Root123..@127.0.0.1:3306/flasenc';

// **`--accept-data-loss`**：本地 / CI 空库上 **`db push`** 若遇「加唯一索引」等提示时仍继续（勿对含生产数据的库执行本脚本）。
const r = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'db',
    'push',
    '--accept-data-loss',
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
