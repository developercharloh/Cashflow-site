---
name: Lipwa Tasks product scope
description: Durable product decisions for work categories, task rewards, wallet rates, and payment methods
---

## Product scope
- Work listings are limited to Academic Writing, Data Entry, Transcription, and AI Training. Keep first-party tasks challenging and self-contained, but make them open to Level 1 workers by default; do not require an outside provider account. Academic tasks must not be graded assignments. Engineering and computer-science technical writing belongs under Academic Writing. Never show a “Hard” or expert-only label to users.
- Simple Quiz is Coming Soon and must not issue quiz rewards until re-enabled. Soft Loans remain separate; Forex is Coming Soon, not an active trading feature.

**Why:** The user explicitly chose these as the site's content, asked not to retain the old trading product, requested challenging work that ordinary new workers can access, and specifically said not to label tasks “Hard.”

**How to apply:** Keep work listings inside those four categories; include engineering and computer-science writing tasks under Academic Writing; build original tasks when no licensed source is available; let the admin review, set the reward and completion budget, and post them. Keep quiz disabled and do not restore trading dashboards or unrelated gig categories.

## Platform-funded task rewards
- Task rewards are platform-funded; an administrator sets a per-task payout ceiling and completion cap. Approval credits the worker's in-app balance. The ceiling is not an escrow transfer or proof of external funds.

**Why:** The user chose platform funding; the app does not hold escrow for each task.

**How to apply:** Make the cap and manual review visible to workers and admins; never describe the cap as money already escrowed.

## Task packages, bids, referrals, and deadlines
- Silver costs $7.69 and Diamond costs $19.23. Both provide one-time permanent access to unlimited task bids; no extra Diamond benefit is defined. Upgrading Silver to Diamond costs only the price difference. Existing paid members retain access as legacy members. Package purchases debit the wallet; if funds are short, prompt for the exact wallet deposit shortfall, then let the user retry.
- A valid signup through a referral link earns the referrer $1 immediately, once. Bids may be submitted by multiple workers, but each funded place is assigned to one worker; work starts only after assignment. The configurable submission deadline begins on assignment and defaults to 72 hours. Late work must be blocked.

**Why:** The user set package prices, wallet-funded package purchases, one-dollar referrals, multi-worker bidding, admin assignment, and submission deadlines. Package duration/tier differences and referral timing were unspecified, so permanent access and immediate signup reward are the chosen assumptions.

**How to apply:** Debit only the package charge (or Silver-to-Diamond price difference) from the wallet. If the wallet is short, show the exact shortfall and offer a deposit flow that returns the user to packages; the package payment itself must not launch a direct M-Pesa prompt. Preserve existing paid access and do not invent tier benefits. Tell workers their bid was submitted and to check whether it was assigned; do not describe the bid as awaiting admin approval.

## Wallet methods and rates
- Deposit rate is USD 1 = KES 130; withdrawal quote is USD 1 = KES 125. M-Pesa Express deposits use PayHero; card deposits are Coming Soon.
- M-Pesa deposits must accept any phone supported by the connected channel, not a creator-specific number; normalize local and +254 formats consistently.
- Withdrawals are manual requests: users choose a method, and the admin sends the payout externally before marking the request complete. The user-facing status stays simply Pending until completion; do not mention admin approval to the user.
- KYC requires identity details and private ID images stored in Vercel Blob; users must capture selfies with the front camera, and all identity photos are resized/compressed to the 5 MB upload limit. Administrators review submissions, and withdrawals stay blocked until approval. Users see only “Under review,” not the review method or reviewer role.

**Why:** The user supplied the rates and PayHero deposit method, specified that withdrawals remain pending until admin completion, disabled Simple Quiz for now, and chose admin-reviewed KYC while requiring client-facing status to say only “Under review.”

**Why:** The user said deposits and package purchases must work for all users' supported M-Pesa numbers, not only their own.

**How to apply:** Keep displayed rates consistent with backend conversion, verify PayHero transaction status server-to-server before crediting deposits, require a fresh camera-captured selfie, optimize uploaded identity images before private storage, do not expose the payment provider's brand or KYC review method to users, and do not send withdrawals automatically.

**How to apply:** Do not hardcode or whitelist an individual user's number. Normalize accepted local and +254 formats before sending requests to PayHero; reject only numbers the configured M-Pesa channel cannot support.

## Imported project runtime
- Imported repositories can contain artifact configuration without a registered artifact preview; confirm the registered workflow and actual frontend endpoint before relying on the artifact file alone.

**Why:** A healthy Vite process once failed the generic workflow port probe in an imported project.

**How to apply:** Compare artifact registration with configured workflows, then verify the served endpoint after startup.
