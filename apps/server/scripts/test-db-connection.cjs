'use strict';

const fs = require('node:fs');
const path = require('node:path');

const out = path.join(__dirname, '..', '.db-connection-test-result.txt');

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

  const defaultUrl =
    'mysql://root:root123..@127.0.0.1:3307/flasenc';
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
