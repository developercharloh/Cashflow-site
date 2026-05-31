---
name: TaskEarn Pro Stack
description: Architecture decisions, auth flow, and level-up rules for TaskEarn Pro
---

## Auth
- JWT stored in localStorage key `"token"` — read by `custom-fetch.ts` via `Authorization: Bearer`
- `requireAuth` and `requireAdmin` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`
- `getLevelName()` lives in `artifacts/api-server/src/routes/auth.ts` — imported by other route files, do not move

## Level system
- Level 1 Explorer: $0+, Level 2 Builder: $50+, Level 3 Professional: $200+, Level 4 Elite: $500+
- Level is recalculated on task completion using `totalEarned` threshold in `routes/tasks.ts`

## DB schema location
- `lib/db/src/schema/` — separate files per table, all exported from `index.ts`
- After schema changes: `pnpm --filter @workspace/db run push`

## Codegen
- After OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
- Never import generated files directly — always use `@workspace/api-client-react` barrel

## Demo credentials
- Admin: admin@taskearnpro.com / password
- Elite user: carol@example.com / password
- Email verify code for demo: 123456 (stored in emailVerifyCode column; never actually sent)

**Why:** JWT in localStorage avoids cookie CORS complexity in the proxied Replit env. Contract-first codegen keeps frontend/backend in sync automatically.
