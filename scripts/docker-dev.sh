#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing workspace dependencies"
pnpm install --frozen-lockfile

echo "==> Preparing Prisma"
pnpm --filter @flasenc/server exec prisma generate --schema=libs/database/prisma/schema.prisma
pnpm --filter @flasenc/server run db:migrate:deploy
pnpm --filter @flasenc/server run db:seed:admin

cleanup() {
  jobs -pr | xargs -r kill
}
trap cleanup EXIT INT TERM

echo "==> Starting Flasenc services"
PORT=3000 pnpm --filter @flasenc/server run start:dev &
PORT=3001 pnpm --filter @flasenc/server run start:admin:dev &
pnpm --filter @flasenc/admin-web exec vite --host 0.0.0.0 &

wait
