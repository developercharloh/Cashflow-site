---
name: Lipwa Tasks product scope
description: Durable product decisions for work categories, task rewards, wallet rates, and payment methods
---

## Product scope
- Work listings are limited to Academic Writing, Data Entry, Transcription, and AI Training. Keep first-party tasks challenging and self-contained, but make them open to Level 1 workers by default; do not require an outside provider account. Academic tasks must not be graded assignments. Written/file work is reviewed by an administrator before rewards are credited.
- Simple Quiz and Soft Loans remain separate product areas; Forex is Coming Soon, not an active trading feature.

**Why:** The user explicitly chose these as the site's content, asked not to retain the old trading product, and requested professional hard work that ordinary new workers can access.

**How to apply:** Keep work listings inside those four categories; build original tasks when no licensed source is available; let the admin review, set the reward and completion budget, and post them. Keep quiz separate and do not restore trading dashboards or unrelated gig categories.

## Platform-funded task rewards
- Task rewards are platform-funded; an administrator sets a per-task payout ceiling and completion cap. Approval credits the worker's in-app balance. The ceiling is not an escrow transfer or proof of external funds.

**Why:** The user chose platform funding; the app does not hold escrow for each task.

**How to apply:** Make the cap and manual review visible to workers and admins; never describe the cap as money already escrowed.

## Wallet methods and rates
- Deposit rate is USD 1 = KES 130; withdrawal quote is USD 1 = KES 125. M-Pesa Express deposits use PayHero; card deposits are Coming Soon.
- Withdrawals are manual requests: users choose a method, and the admin sends the payout externally before marking the request complete. The user-facing status stays simply Pending until completion; do not mention admin approval to the user.
- New KYC submissions are Coming Soon. Keep the existing approved-KYC withdrawal requirement unless the user explicitly changes it.

**Why:** The user supplied the rates and PayHero deposit method, then specified that withdrawals should remain pending until manual admin completion and KYC should show Coming Soon. PayHero's public API docs documented STK payments and status checks but no payout endpoint.

**How to apply:** Keep displayed rates consistent with backend conversion, verify PayHero transaction status server-to-server before crediting deposits, do not expose the payment provider's brand to users, and do not send withdrawals automatically.

## Imported project runtime
- Imported repositories can contain artifact configuration without a registered artifact preview; confirm the registered workflow and actual frontend endpoint before relying on the artifact file alone.

**Why:** A healthy Vite process once failed the generic workflow port probe in an imported project.

**How to apply:** Compare artifact registration with configured workflows, then verify the served endpoint after startup.
