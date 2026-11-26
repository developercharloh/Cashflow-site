---
name: Lipwa Tasks product scope
description: Durable product decisions for work categories, task rewards, wallet rates, and payment methods
---

## Product scope
- Work listings are limited to Academic Writing, Data Entry, Transcription, and AI Training. Keep first-party tasks challenging and self-contained, but make them open to Level 1 workers by default; do not require an outside provider account. Academic tasks must not be graded assignments. Written/file work is reviewed by an administrator before rewards are credited.
- Simple Quiz is Coming Soon and must not issue quiz rewards until re-enabled. Soft Loans remain separate; Forex is Coming Soon, not an active trading feature.

**Why:** The user explicitly chose these as the site's content, asked not to retain the old trading product, and requested professional hard work that ordinary new workers can access.

**How to apply:** Keep work listings inside those four categories; build original tasks when no licensed source is available; let the admin review, set the reward and completion budget, and post them. Keep quiz disabled and do not restore trading dashboards or unrelated gig categories.

## Platform-funded task rewards
- Task rewards are platform-funded; an administrator sets a per-task payout ceiling and completion cap. Approval credits the worker's in-app balance. The ceiling is not an escrow transfer or proof of external funds.

**Why:** The user chose platform funding; the app does not hold escrow for each task.

**How to apply:** Make the cap and manual review visible to workers and admins; never describe the cap as money already escrowed.

## Task packages, bids, referrals, and deadlines
- Silver costs $7.69 and Diamond costs $19.23. Both provide one-time permanent access to unlimited task bids; no extra Diamond benefit is defined. Upgrading Silver to Diamond costs only the price difference. Existing paid members retain access as legacy members.
- A valid signup through a referral link earns the referrer $1 immediately, once. Bids may be submitted by multiple workers, but each funded place is assigned to one worker; work starts only after assignment. The configurable submission deadline begins on assignment and defaults to 72 hours. Late work must be blocked.

**Why:** The user set package prices, wallet payment, one-dollar referrals, multi-worker bidding, admin assignment, and submission deadlines. Package duration/tier differences and referral timing were unspecified, so permanent access and immediate signup reward are the chosen assumptions.

**How to apply:** Charge packages from the wallet, preserve existing paid access, and do not invent tier benefits. Tell workers their bid was submitted and to check whether it was assigned; do not describe the bid as awaiting admin approval.

## Wallet methods and rates
- Deposit rate is USD 1 = KES 130; withdrawal quote is USD 1 = KES 125. M-Pesa Express deposits use PayHero; card deposits are Coming Soon.
- Withdrawals are manual requests: users choose a method, and the admin sends the payout externally before marking the request complete. The user-facing status stays simply Pending until completion; do not mention admin approval to the user.
- KYC requires identity details and private ID images stored in Vercel Blob; administrators review submissions, and withdrawals stay blocked until approval. Users see only “Under review,” not the review method or reviewer role.

**Why:** The user supplied the rates and PayHero deposit method, specified that withdrawals remain pending until admin completion, disabled Simple Quiz for now, and chose admin-reviewed KYC while requiring client-facing status to say only “Under review.”

**How to apply:** Keep displayed rates consistent with backend conversion, verify PayHero transaction status server-to-server before crediting deposits, do not expose the payment provider's brand or KYC review method to users, and do not send withdrawals automatically.

## Imported project runtime
- Imported repositories can contain artifact configuration without a registered artifact preview; confirm the registered workflow and actual frontend endpoint before relying on the artifact file alone.

**Why:** A healthy Vite process once failed the generic workflow port probe in an imported project.

**How to apply:** Compare artifact registration with configured workflows, then verify the served endpoint after startup.
