'use strict';

const fs = require('node:fs');
const path = require('node:path');

const out = path.join(__dirname, '..', '.db-connection-test-result.txt');

async function main() {
  const defaultUrl =
    'mysql://root:Root123..@127.0.0.1:3306/flasenc';
  process.env.DATABASE_URL ??= defaultUrl;
  const url = process.env.DATABASE_URL;
  if (!url) {
    fs.writeFileSync(out, 'FAIL: DATABASE_URL is not set\n', 'utf8');
    process.exit(1);
  }
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$disconnect();
    fs.writeFileSync(out, 'OK: Prisma $connect succeeded\n', 'utf8');
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(
      out,
      `FAIL: ${e && e.message ? e.message : String(e)}\n`,
      'utf8',
    );
    process.exit(1);
  }
}

void main();
