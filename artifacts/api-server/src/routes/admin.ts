import { Router } from "express";
import { db, usersTable, tasksTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";

const router = Router();

router.get("/admin/users", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { search } = req.query as { search?: string };
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }

    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      level: u.level,
      balance: u.balance,
      tasksCompleted: u.tasksCompleted,
      referralCount: u.referralCount,
      isBanned: u.isBanned,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id/ban", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { banned } = req.body;
    const [user] = await db.update(usersTable).set({ isBanned: !!banned })
      .where(eq(usersTable.id, id)).returning();
    res.json({
      id: user.id, email: user.email, name: user.name, level: user.level,
      balance: user.balance, tasksCompleted: user.tasksCompleted, referralCount: user.referralCount,
      isBanned: user.isBanned, isAdmin: user.isAdmin, createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/tasks", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
    res.json(tasks);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/tasks", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, description, category, reward, estimatedMinutes, difficulty, minLevel, instructions, isActive } = req.body;
    const [task] = await db.insert(tasksTable).values({
      title, description, category, reward, estimatedMinutes, difficulty,
      minLevel: minLevel ?? 1, instructions, isActive: isActive ?? true,
    }).returning();
    res.status(201).json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/tasks/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const [task] = await db.update(tasksTable).set({ ...updates, updatedAt: new Date() })
      .where(eq(tasksTable.id, id)).returning();
    res.json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/tasks/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(tasksTable).set({ isActive: false }).where(eq(tasksTable.id, id));
    res.json({ message: "Task deactivated" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/withdrawals", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };
    const txns = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.type, "withdrawal"))
      .orderBy(desc(transactionsTable.createdAt));

    const filtered = status ? txns.filter(t => t.status === status) : txns;

    const userIds = [...new Set(filtered.map(t => t.userId))];
    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u.name]));

    res.json(filtered.map(t => ({
      id: t.id,
      userId: t.userId,
      userName: userMap.get(t.userId) ?? "Unknown",
      amount: t.amount,
      method: t.method ?? "",
      accountDetails: t.accountDetails ?? "",
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/withdrawals/:id/approve", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [txn] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }

    const [updated] = await db.update(transactionsTable).set({ status: "completed" })
      .where(eq(transactionsTable.id, id)).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, txn.userId));
    if (user) {
      await db.update(usersTable).set({
        pendingEarnings: Math.max(0, user.pendingEarnings - txn.amount),
      }).where(eq(usersTable.id, txn.userId));

      await db.insert(notificationsTable).values({
        userId: txn.userId,
        type: "withdrawal",
        title: "Withdrawal Approved",
        message: `Your withdrawal of $${txn.amount.toFixed(2)} has been approved and is on its way.`,
      });
    }

    const users2 = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = new Map(users2.map(u => [u.id, u.name]));

    res.json({
      id: updated.id, userId: updated.userId, userName: userMap.get(updated.userId) ?? "Unknown",
      amount: updated.amount, method: updated.method ?? "", accountDetails: updated.accountDetails ?? "",
      status: updated.status, createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/withdrawals/:id/reject", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const [txn] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }

    const [updated] = await db.update(transactionsTable).set({ status: "rejected", rejectionReason: reason })
      .where(eq(transactionsTable.id, id)).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, txn.userId));
    if (user) {
      await db.update(usersTable).set({
        balance: user.balance + txn.amount,
        pendingEarnings: Math.max(0, user.pendingEarnings - txn.amount),
        totalWithdrawn: Math.max(0, user.totalWithdrawn - txn.amount),
      }).where(eq(usersTable.id, txn.userId));

      await db.insert(notificationsTable).values({
        userId: txn.userId,
        type: "withdrawal",
        title: "Withdrawal Rejected",
        message: `Your withdrawal of $${txn.amount.toFixed(2)} was rejected. Reason: ${reason}. Funds returned to your balance.`,
      });
    }

    const users2 = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = new Map(users2.map(u => [u.id, u.name]));

    res.json({
      id: updated.id, userId: updated.userId, userName: userMap.get(updated.userId) ?? "Unknown",
      amount: updated.amount, method: updated.method ?? "", accountDetails: updated.accountDetails ?? "",
      status: updated.status, createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/analytics", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select().from(usersTable);
    const allTxns = await db.select().from(transactionsTable);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = allUsers.filter(u => u.createdAt >= thirtyDaysAgo);
    const monthlyRevenue = allTxns.filter(t => t.type === "earning" && t.createdAt >= thirtyDaysAgo).reduce((s, t) => s + t.amount, 0);
    const withdrawals = allTxns.filter(t => t.type === "withdrawal");

    res.json({
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(u => u.tasksCompleted > 0).length,
      totalTasksCompleted: allUsers.reduce((s, u) => s + u.tasksCompleted, 0),
      totalEarningsPaid: allUsers.reduce((s, u) => s + u.totalWithdrawn, 0),
      totalWithdrawals: withdrawals.length,
      pendingWithdrawals: withdrawals.filter(t => t.status === "pending").length,
      revenueThisMonth: monthlyRevenue,
      newUsersThisMonth: newUsers.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/announcements", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, message, type } = req.body;
    const [notif] = await db.insert(notificationsTable).values({
      type: type ?? "announcement",
      title,
      message,
      isGlobal: true,
    }).returning();
    res.status(201).json({ ...notif, createdAt: notif.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
