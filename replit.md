# TaskEarn Pro

A full-stack premium fintech-style earning platform where users complete tasks (surveys, videos, articles, AI training, etc.), earn money, refer friends, level up through membership tiers, and withdraw earnings via M-Pesa, Bank Transfer, or PayPal. Includes a full admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/task-earn-pro run dev` — run the frontend (port 24629, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS v4, shadcn/ui, Wouter (routing), Framer Motion, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: JWT tokens in localStorage key `"token"`, verified via Bearer header

## Where things live

- `lib/db/src/schema/` — all DB table schemas, exported from `index.ts`
- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/api.ts` — all generated hooks (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers per domain
- `artifacts/api-server/src/routes/index.ts` — route registration
- `artifacts/api-server/src/middlewares/requireAuth.ts` — auth + admin middleware
- `artifacts/api-server/src/lib/auth.ts` — JWT/bcrypt helpers
- `artifacts/task-earn-pro/src/App.tsx` — all client-side routes
- `artifacts/task-earn-pro/src/hooks/use-auth.tsx` — auth context
- `artifacts/task-earn-pro/src/components/layout.tsx` — AppLayout + Sidebar
- `artifacts/task-earn-pro/src/index.css` — dark navy/blue theme (CSS variables)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks + Zod schemas
- JWT in localStorage with `Authorization: Bearer` header, no cookie sessions
- Membership levels 1–4 (Explorer/Builder/Professional/Elite) gated by `totalEarned` thresholds: $0/$50/$200/$500
- All route imports go through `@workspace/api-client-react` barrel (never import generated files directly)
- Admin routes require `isAdmin: true` in JWT payload, verified in `requireAdmin` middleware

## Product

- **Landing page** — marketing page with hero, features, how-it-works, FAQ, social proof
- **Auth flow** — Register → Verify Email → Welcome Quiz → Dashboard; Login → Dashboard
- **Welcome Quiz** — 10-question quiz awarding $1–$5 bonus based on score
- **Dashboard** — balance, level progress, streak, recent activity, earnings chart
- **Task Marketplace** — browse/filter tasks by category, start & complete tasks to earn rewards
- **Wallet** — full transaction history, withdrawal requests (M-Pesa/Bank/PayPal, min $5)
- **Referrals** — referral link/QR code, referred user list, earnings tracking
- **Leaderboard** — top earners, referrers, task completers; weekly/monthly/all-time
- **Membership** — level overview, perks per tier, progress to next level
- **Notifications** — read/unread, mark all read, real-time type icons
- **Admin Panel** — analytics dashboard, user management (ban/unban), task CRUD, withdrawal approvals

## Demo Credentials

- Admin: `ckyalo011@gmail.com` / `Charloz!1999`
- User (Elite): `carol@example.com` / `password`
- User (Builder): `bob@example.com` / `password`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before touching frontend
- `bcryptjs` is in devDependencies of api-server (bundled by esbuild, so fine)
- The `getLevelName` helper lives in `routes/auth.ts` and is imported by other route files — do not move it
- Email verification code is stored in `emailVerifyCode` column; for demo use code `123456` (column is set during register)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
