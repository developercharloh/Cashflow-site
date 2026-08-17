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
    if (!amount || amount <= 0 || !method || !accountDetails) {
      res.status(400).json({ error: "Amount, method, and account details are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (user.kycStatus !== "approved") {
      res.status(403).json({ error: "Identity verification required before withdrawal. Please complete KYC on your profile.", code: "KYC_REQUIRED" });
      return;
    }
    if (user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    if (amount < 0.5) {
      res.status(400).json({ error: "Minimum withdrawal is $0.50" });
      return;
    }

    // Atomic conditional deduct: only succeeds if balance is still sufficient at commit time,
    // preventing concurrent requests from double-spending the same funds.
    const updated = await db.update(usersTable).set({
      balance: sql`${usersTable.balance} - ${amount}`,
      pendingEarnings: sql`${usersTable.pendingEarnings} + ${amount}`,
      totalWithdrawn: sql`${usersTable.totalWithdrawn} + ${amount}`,
    }).where(sql`${usersTable.id} = ${req.userId!} AND ${usersTable.balance} >= ${amount}`).returning({ id: usersTable.id });

    if (updated.length === 0) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const [txn] = await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      amount,
      status: "pending",
      description: `Withdrawal via ${method}`,
      method,
      accountDetails,
    }).returning();

    await db.insert(notificationsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      title: "Withdrawal Requested",
      message: `Your withdrawal of $${amount.toFixed(2)} via ${method} is being processed.`,
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

// ─── Auto-complete stale pending transactions (deposit + withdrawal) ──────────
// Called from the wallet page on load. Marks transactions that have been
// pending for >5 minutes as completed so users see real status immediately.
router.post("/wallet/auto-complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find stale pending transactions for this user
    const stale = await db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.status, "pending"),
        lt(transactionsTable.createdAt, fiveMinutesAgo),
      )
    );

    if (stale.length === 0) {
      res.json({ completed: 0 });
      return;
    }

    let completed = 0;
    for (const txn of stale) {
      // Atomically flip pending → completed; if another path (e.g. webhook)
      // already completed this transaction the WHERE clause won't match and
      // no rows are returned, so we skip crediting entirely.
      const updated = await db.update(transactionsTable)
        .set({ status: "completed" })
        .where(and(
          eq(transactionsTable.id, txn.id),
          eq(transactionsTable.status, "pending"),
        ))
        .returning({ id: transactionsTable.id });

      if (updated.length === 0) continue; // already completed by another path

      // For deposits: credit the balance if not already credited
      if (txn.type === "deposit") {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
        await db.update(usersTable).set({
          balance: user.balance + txn.amount,
          totalEarned: user.totalEarned + txn.amount,
        }).where(eq(usersTable.id, req.userId!));

        await db.insert(notificationsTable).values({
          userId: req.userId!,
          type: "deposit",
          title: "Deposit Confirmed",
          message: `$${txn.amount.toFixed(2)} has been credited to your wallet.`,
        });
      }

      // For withdrawals: just mark complete (funds already deducted at request time)
      if (txn.type === "withdrawal") {
        await db.update(usersTable).set({
          pendingEarnings: sql`GREATEST(0, ${usersTable.pendingEarnings} - ${txn.amount})`,
        }).where(eq(usersTable.id, req.userId!));

        await db.insert(notificationsTable).values({
          userId: req.userId!,
          type: "withdrawal",
          title: "Withdrawal Completed",
          message: `Your withdrawal of $${txn.amount.toFixed(2)} has been processed.`,
        });
      }

      completed++;
    }

    res.json({ completed });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
