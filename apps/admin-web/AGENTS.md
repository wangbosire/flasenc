# AGENTS.md

You are working in the Flasenc admin web app. It is based on `satnaing/shadcn-admin` and uses React, Vite, TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS, Radix UI, Zustand, ESLint, Vitest, and TypeScript.

## Commands

- `pnpm run dev` - Start the dev server
- `pnpm run build` - Build the app for production
- `pnpm run preview` - Preview the production build locally
- `pnpm run lint` - Run ESLint
- `pnpm run test` - Run the local unit test subset

## Docs

- Upstream template: https://github.com/satnaing/shadcn-admin
- shadcn/ui: https://ui.shadcn.com
- TanStack Router: https://tanstack.com/router/latest
- Vite: https://vite.dev

## Tools

### Vitest

- Run `pnpm run test` to run tests
- Run `pnpm run test:watch` to run tests in watch mode

### ESLint

- Run `pnpm run lint` to lint your code

### Prettier

- Run `pnpm run format` to format your code

## Project constraints

- Keep backend calls behind `src/api/http.ts` and preserve the HTTP envelope / `error.code` contract.
- Keep shadcn/ui component updates deliberate; upstream notes customized RTL-aware components in `src/components/ui/`.
- Do not reintroduce Clerk as the primary Flasenc admin auth path; Flasenc login uses `/admin/v1/auth/login`.
