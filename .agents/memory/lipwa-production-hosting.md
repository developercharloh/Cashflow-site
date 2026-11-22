---
name: Lipwa Tasks hosting
description: Hosting and migration constraints for Lipwa Tasks production
---

Production must not depend on Replit hosting. Neon Postgres was chosen for the database, and transferring existing user data and files was approved.

**Why:** The user is concerned the app would go offline if they stop paying for Replit.

**How to apply:** Move the API, database, file storage, and public/admin frontends to external hosting before cutover. Keep Replit only as a temporary source for one-time data migration, not as a production runtime dependency.

## Vercel shared environment variables
- PayHero and other shared secrets are stored as team-level Vercel variables, not project-level variables. Verify that each shared variable is linked to the intended project and targets Production.

**Why:** The Vercel project environment-variable endpoint returned no project variables even though the user had correctly configured the values in the team's Shared tab.

**How to apply:** Query the team shared-variable list filtered by project and inspect only variable names, targets, and project links. Never read or log secret values.
