---
name: Vercel Vite API routing
description: Deployment behavior to check when a Vite app also serves API routes on Vercel
---

Vercel can report a Vite deployment as READY while API requests fall through to the SPA rewrite because the serverless function was not emitted. A passing build and healthy root page do not verify API availability.

**Why:** The admin deployment initially served `index.html` for health checks and returned 405 for login even though Vercel reported a successful deployment.

**How to apply:** Use an explicit API function route and route `/api/*` to it before the SPA fallback. After deploy, verify a JSON health endpoint and an unauthenticated protected endpoint on the production domain.
