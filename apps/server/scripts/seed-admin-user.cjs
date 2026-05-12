'use strict';

const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadDotEnv(path.join(__dirname, '..', '.env'));

  process.env.DATABASE_URL ??=
    'mysql://root:root123..@127.0.0.1:3307/flasenc';

  const email = process.env.FLASENC_SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.FLASENC_SEED_ADMIN_PASSWORD ?? 'admin123..';
  const passwordHash = bcrypt.hashSync(password, 10);

  const prisma = new PrismaClient();
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      platformAdmin: true,
    },
    update: {
      passwordHash,
      platformAdmin: true,
    },
    select: {
      id: true,
      email: true,
      platformAdmin: true,
    },
  });

  await prisma.$disconnect();

  console.log(
    `Seeded platform admin: ${user.email} (${user.id}), platformAdmin=${user.platformAdmin}`,
  );
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
