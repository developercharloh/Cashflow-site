---
name: Lipwa Tasks hosting
description: Hosting and migration constraints for Lipwa Tasks production
---

Production must not depend on Replit hosting. Neon Postgres was chosen for the database, and transferring existing user data and files was approved.

**Why:** The user is concerned the app would go offline if they stop paying for Replit.

**How to apply:** Move the API, database, file storage, and public/admin frontends to external hosting before cutover. Keep Replit only as a temporary source for one-time data migration, not as a production runtime dependency.
