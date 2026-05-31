import { Router } from "express";
import { db, usersTable, transactionsTable, tasksTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";

const router = Router();

function getLevelProgress(user: typeof usersTable.$inferSelect): number {
  const thresholds = [0, 50, 200, 500, Infinity];
  const lo = thresholds[user.level - 1] ?? 0;
  const hi = thresholds[user.level] ?? 500;
  if (hi === Infinity) return 100;
  return Math.min(100, Math.round(((user.totalEarned - lo) / (hi - lo)) * 100));
}

router.get("/dashboard/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const availableTasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.isActive, true)));
    const accessible = availableTasks.filter(t => t.minLevel <= user.level);

    res.json({
      balance: user.balance,
      pendingEarnings: user.pendingEarnings,
      totalWithdrawn: user.totalWithdrawn,
      level: user.level,
      levelName: getLevelName(user.level),
      levelProgress: getLevelProgress(user),
      referralCount: user.referralCount,
      tasksCompleted: user.tasksCompleted,
      tasksAvailable: accessible.length,
      streakDays: user.streakDays,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const txns = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, req.userId!))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(15);

    res.json(txns.map(t => ({
      id: t.id,
      type: t.type,
      description: t.description,
      amount: t.amount,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/earnings-chart", requireAuth, async (req: AuthRequest, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const txns = await db.select().from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, req.userId!),
        gte(transactionsTable.createdAt, since),
      ));

    const byDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }

    for (const t of txns) {
      if (t.type !== "withdrawal" && t.amount > 0) {
        const day = t.createdAt.toISOString().slice(0, 10);
        if (byDay[day] !== undefined) byDay[day] += t.amount;
      }
    }

    res.json(Object.entries(byDay).map(([date, amount]) => ({ date, amount })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
