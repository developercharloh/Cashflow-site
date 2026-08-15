---
name: TaskEarn Pro Stack
description: Architecture decisions, auth flow, level-up rules, and Elite Signals Pro trading dashboard layout
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

## Imported project runtime
- Imported repositories may contain valid `.replit-artifact/artifact.toml` files without being registered as preview artifacts in the current environment. When that happens, configure the primary frontend as the single web workflow; omitting `waitForPort` can avoid false startup timeouts even when Vite is listening.

**Why:** The generic workflow port probe timed out against a healthy Vite server during import, while the same workflow stayed healthy when started without an explicit port probe.

**How to apply:** After importing a repository, compare `listArtifacts()` with the repo's artifact configs, then verify the actual frontend endpoint and workflow state before delivering.

## Elite Signals Pro — trading dashboard overlay

The app has been re-skinned as a trading dashboard while keeping original auth/admin routes intact.

### Theme
- Always dark navy — CSS variables hardcoded in `src/index.css` (no light mode toggle): background `220 30% 7%`, card `220 28% 11%`, primary `142 72% 45%` (green)
- `.dark` class duplicates same vars so legacy shadcn/ui components that write `dark:...` classes still resolve correctly

### Routing (Wouter)
- `/` → redirect → `/dashboard` (TradingHome)
- `/markets` → MarketsPage; `/markets/:symbol` → SignalDetailPage
- `/signals` → SignalsPage; `/analytics` → AnalyticsPage; `/history` → HistoryPage; `/settings` → SettingsPage
- Legacy preserved: `/binary`, `/auth/*`, `/admin/*`, `/profile`, `/callback`

### Bottom nav
- 5 items: Home, Markets, Signals, History, Settings — in `src/components/layout.tsx`
- Active highlight uses `text-primary` + green glow drop-shadow

### Trading engine (`src/lib/trading-engine.ts`)
- All Deriv synthetic markets catalogued with vol + base price per market
- `buildTicks()` / `nextPrice()` for client-side simulation (no WebSocket needed for demo mode)
- `computeTickStats()` returns 1000-tick digit frequency, even/odd split
- `generateSignal()` derives direction + confidence from stats
- Payout table: even/odd 1.90×, rise/fall 1.85×, matches 9.00×, differs 1.10×, touch 1.75×, notouch 1.90×
- Over/Under barrier-variable: `0.95 / (winDigits / 10)`

### Account modes
- Demo balance stored in `localStorage("elite_demo")`, starts at $10,000, resettable from Settings
- Real balance from `user.balance` (API); shows $0 until real account connected
- Mode stored in `localStorage("trading_mode")` — "demo" | "real"

### Trade records
- Stored in `localStorage("elite_trade_history")` as JSON array (max 200)
- History page reads this and seeds demo data on first load

### Deposit methods
- Stubbed in Settings: Card, M-Pesa, TRC20, BEP20, ERC20, PayPal — toast on tap
- Real payment flow requires connecting Stripe (connector available) or PayPal (catalog connector)

**Why:** The overlay approach (additive routes, same auth, same API server) lets the trading UI and original task-earning features coexist without a codebase split.
