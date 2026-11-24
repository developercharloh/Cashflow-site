import { Router } from "express";
import { db, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, desc, sql, and, lt } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    res.json({
      balance: user.balance,
      pendingEarnings: user.pendingEarnings,
      totalEarned: user.totalEarned,
      totalWithdrawn: user.totalWithdrawn,
      totalReferralEarnings: user.totalReferralEarnings,
      totalTaskEarnings: user.totalTaskEarnings,
      totalBonusEarnings: user.totalBonusEarnings,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/wallet/transactions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, page = "1", limit = "20" } = req.query as { type?: string; page?: string; limit?: string };
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const txns = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, req.userId!))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    let filtered = txns;
    if (type) filtered = txns.filter(t => t.type === type);

    res.json(filtered.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      description: t.description,
      method: t.method,
      rejectionReason: t.rejectionReason ?? null,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wallet/withdraw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount, method, accountDetails } = req.body;
    const amountUsd = Number(amount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !method || !accountDetails) {
      res.status(400).json({ error: "Amount, method, and account details are required" });
      return;
    }
    const normalizedMethod = String(method).toLowerCase();
    if (!["mpesa", "airtel", "bank", "paypal"].includes(normalizedMethod)) {
      res.status(400).json({ error: "That withdrawal method is not currently available." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.kycStatus !== "approved") {
      res.status(403).json({ error: "Withdrawals require an approved identity verification.", code: "KYC_REQUIRED" });
      return;
    }
    if (user.balance < amountUsd) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    if (amountUsd < 0.5) {
      res.status(400).json({ error: "Minimum withdrawal is $0.50" });
      return;
    }

    // Atomic conditional deduct: only succeeds if balance is still sufficient at commit time,
    // preventing concurrent requests from double-spending the same funds.
    const updated = await db.update(usersTable).set({
      balance: sql`${usersTable.balance} - ${amountUsd}`,
      pendingEarnings: sql`${usersTable.pendingEarnings} + ${amountUsd}`,
      totalWithdrawn: sql`${usersTable.totalWithdrawn} + ${amountUsd}`,
    }).where(sql`${usersTable.id} = ${req.userId!} AND ${usersTable.balance} >= ${amountUsd}`).returning({ id: usersTable.id });

    if (updated.length === 0) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const [txn] = await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      amount: amountUsd,
      status: "pending",
      description: `Withdrawal request via ${normalizedMethod}`,
      method: normalizedMethod,
      accountDetails: typeof accountDetails === "string"
        ? accountDetails.trim()
        : JSON.stringify(accountDetails),
    }).returning();

    await db.insert(notificationsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      title: "Withdrawal Pending",
      message: "Your withdrawal request is pending.",
    });

    res.json({
      id: txn.id,
      type: txn.type,
      amount: txn.amount,
      status: txn.status,
      description: txn.description,
      method: txn.method,
      createdAt: txn.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Crypto wallet addresses (from env) ──────────────────────────────────────
router.get("/wallet/crypto-config", requireAuth, async (_req, res) => {
  res.json({
    trc20: process.env.USDT_TRC20_ADDRESS ?? "",
    bep20: process.env.USDT_BEP20_ADDRESS ?? "",
    erc20: process.env.USDT_ERC20_ADDRESS ?? "",
    paypalEmail: process.env.PAYPAL_DEPOSIT_EMAIL ?? "",
  });
});

// ─── Submit crypto / PayPal deposit (manual confirmation) ────────────────────
router.post("/wallet/crypto-deposit", requireAuth, async (_req: AuthRequest, res) => {
  res.status(410).json({ error: "Only M-Pesa Express deposits are available. Card deposits are coming soon." });
});

// ─── Auto-complete stale pending transactions (deposit + withdrawal) ──────────
// Called from the wallet page on load. Marks transactions that have been
// pending for >5 minutes as completed so users see real status immediately.
router.post("/wallet/auto-complete", requireAuth, async (req: AuthRequest, res) => {
  // Pending money movements must not be marked paid based on age alone.
  // Deposits are reconciled with Paystack in the verified-charge/status routes;
  // withdrawals wait for their provider/admin settlement flow.
  res.json({ completed: 0 });
});

export default router;
