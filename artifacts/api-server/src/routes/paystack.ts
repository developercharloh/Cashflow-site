import { Router } from "express";
import crypto from "crypto";
import { db, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY!;
const CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL!;

// ─── Initiate deposit ────────────────────────────────────────────────────────
router.post("/paystack/deposit/initialize", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body; // amount in USD dollars
    if (!amount || amount < 1) {
      res.status(400).json({ error: "Minimum deposit is $1" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Paystack works in kobo/pesewas (smallest unit). We treat $1 = 100 units for USD.
    // Actually Paystack accepts NGN/GHS/ZAR/KES/USD — use KES (Kenya Shilling) * 100 for kobo
    // We store earnings in USD but charge in KES: 1 USD ≈ 130 KES (use amount * 13000 for kobo)
    // For simplicity, we'll use NGN and let user choose currency on their end.
    // Best practice: send amount in the smallest currency unit (kobo for NGN, cents for USD)
    const amountKobo = Math.round(amount * 100); // treat as USD cents → Paystack currency

    const reference = `dep_${req.userId}_${Date.now()}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        reference,
        callback_url: CALLBACK_URL,
        metadata: {
          userId: req.userId,
          amountUsd: amount,
          type: "deposit",
        },
        channels: ["card", "bank", "ussd", "mobile_money"],
      }),
    });

    const data = await response.json() as any;
    if (!data.status) {
      res.status(400).json({ error: data.message ?? "Paystack error" });
      return;
    }

    // Record a pending deposit transaction
    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "deposit",
      amount,
      status: "pending",
      description: `Deposit of $${amount.toFixed(2)} via Paystack`,
      method: "paystack",
      accountDetails: reference,
    });

    res.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Verify deposit (called after redirect) ──────────────────────────────────
router.get("/paystack/deposit/verify/:reference", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reference } = req.params;

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    const data = await response.json() as any;

    if (!data.status || data.data.status !== "success") {
      res.status(400).json({ error: "Payment not successful", status: data.data?.status });
      return;
    }

    // Idempotency: check if already credited
    const existing = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.accountDetails, reference));
    const txn = existing[0];

    if (txn && txn.status === "completed") {
      res.json({ message: "Already credited", alreadyCredited: true });
      return;
    }

    const amountUsd = data.data.metadata?.amountUsd ?? data.data.amount / 100;
    const userId = data.data.metadata?.userId ?? req.userId!;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    await db.update(usersTable).set({
      balance: user.balance + amountUsd,
      totalEarned: user.totalEarned + amountUsd,
    }).where(eq(usersTable.id, userId));

    // Mark transaction complete
    if (txn) {
      await db.update(transactionsTable).set({ status: "completed" })
        .where(eq(transactionsTable.id, txn.id));
    } else {
      await db.insert(transactionsTable).values({
        userId,
        type: "deposit",
        amount: amountUsd,
        status: "completed",
        description: `Deposit of $${Number(amountUsd).toFixed(2)} via Paystack`,
        method: "paystack",
        accountDetails: reference,
      });
    }

    await db.insert(notificationsTable).values({
      userId,
      type: "deposit",
      title: "Deposit Successful",
      message: `$${Number(amountUsd).toFixed(2)} has been added to your wallet.`,
    });

    res.json({ message: "Deposit credited", amount: amountUsd });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Initiate withdrawal via Paystack Transfers ──────────────────────────────
router.post("/paystack/withdraw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount, bankCode, accountNumber, accountName } = req.body;

    if (!amount || amount < 5) {
      res.status(400).json({ error: "Minimum withdrawal is $5" });
      return;
    }
    if (!bankCode || !accountNumber || !accountName) {
      res.status(400).json({ error: "Bank code, account number, and account name are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const amountKobo = Math.round(amount * 100);

    // Step 1: Create transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });
    const recipientData = await recipientRes.json() as any;
    if (!recipientData.status) {
      res.status(400).json({ error: recipientData.message ?? "Failed to create recipient" });
      return;
    }
    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountKobo,
        recipient: recipientCode,
        reason: `TaskEarn Pro withdrawal for user ${req.userId}`,
      }),
    });
    const transferData = await transferRes.json() as any;
    if (!transferData.status) {
      res.status(400).json({ error: transferData.message ?? "Transfer failed" });
      return;
    }

    // Deduct balance
    await db.update(usersTable).set({
      balance: user.balance - amount,
      totalWithdrawn: user.totalWithdrawn + amount,
    }).where(eq(usersTable.id, req.userId!));

    const [txn] = await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      amount,
      status: "pending",
      description: `Withdrawal of $${amount.toFixed(2)} to ${accountName} (${accountNumber})`,
      method: "paystack_bank",
      accountDetails: JSON.stringify({ bankCode, accountNumber, accountName, transferCode: transferData.data.transfer_code }),
    }).returning();

    await db.insert(notificationsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      title: "Withdrawal Initiated",
      message: `$${amount.toFixed(2)} withdrawal to ${accountName} is being processed via Paystack.`,
    });

    res.json({
      id: txn.id,
      status: txn.status,
      amount: txn.amount,
      description: txn.description,
      transferCode: transferData.data.transfer_code,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── List supported banks ─────────────────────────────────────────────────────
router.get("/paystack/banks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const response = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=100", {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    const data = await response.json() as any;
    if (!data.status) { res.status(400).json({ error: "Could not fetch banks" }); return; }
    res.json(data.data.map((b: any) => ({ name: b.name, code: b.code })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Webhook (must be public, no requireAuth) ────────────────────────────────
router.post("/paystack/webhook", async (req, res) => {
  const hash = crypto
    .createHmac("sha512", SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    res.status(401).send("Invalid signature");
    return;
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const reference = event.data.reference;
    const amountUsd = event.data.metadata?.amountUsd ?? event.data.amount / 100;
    const userId = event.data.metadata?.userId;

    if (!userId) { res.sendStatus(200); return; }

    const existing = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.accountDetails, reference));
    if (existing[0]?.status === "completed") { res.sendStatus(200); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.sendStatus(200); return; }

    await db.update(usersTable).set({
      balance: user.balance + amountUsd,
      totalEarned: user.totalEarned + amountUsd,
    }).where(eq(usersTable.id, userId));

    if (existing[0]) {
      await db.update(transactionsTable).set({ status: "completed" })
        .where(eq(transactionsTable.id, existing[0].id));
    }

    await db.insert(notificationsTable).values({
      userId,
      type: "deposit",
      title: "Deposit Successful",
      message: `$${Number(amountUsd).toFixed(2)} has been added to your wallet.`,
    });
  }

  if (event.event === "transfer.success") {
    const transferCode = event.data.transfer_code;
    // Mark matching transaction completed
    const all = await db.select().from(transactionsTable);
    for (const t of all) {
      try {
        const details = JSON.parse(t.accountDetails ?? "{}");
        if (details.transferCode === transferCode && t.status === "pending") {
          await db.update(transactionsTable).set({ status: "completed" })
            .where(eq(transactionsTable.id, t.id));
        }
      } catch {}
    }
  }

  if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const transferCode = event.data.transfer_code;
    const all = await db.select().from(transactionsTable);
    for (const t of all) {
      try {
        const details = JSON.parse(t.accountDetails ?? "{}");
        if (details.transferCode === transferCode) {
          // Refund the user
          const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId));
          await db.update(usersTable).set({
            balance: user.balance + t.amount,
            totalWithdrawn: user.totalWithdrawn - t.amount,
          }).where(eq(usersTable.id, t.userId));

          await db.update(transactionsTable).set({ status: "rejected", rejectionReason: event.event })
            .where(eq(transactionsTable.id, t.id));

          await db.insert(notificationsTable).values({
            userId: t.userId,
            type: "withdrawal",
            title: "Withdrawal Failed",
            message: `Your withdrawal of $${t.amount.toFixed(2)} was reversed and refunded to your wallet.`,
          });
        }
      } catch {}
    }
  }

  res.sendStatus(200);
});

export { PUBLIC_KEY };
export default router;
