import { Router } from "express";
import {
  adminAuditLogsTable,
  db,
  usersTable,
  tasksTable,
  transactionsTable,
  notificationsTable,
  userTasksTable,
  taskSubmissionsTable,
} from "@workspace/db";
import { and, eq, desc, ilike, ne, or, sql } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";

const router = Router();
const ALLOWED_WORK_CATEGORIES = new Set(["Academic Writing", "Data Entry", "Transcription", "AI Training"]);

function toAdminUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    level: user.level,
    balance: user.balance,
    tasksCompleted: user.tasksCompleted,
    referralCount: user.referralCount,
    isBanned: user.isBanned,
    isAdmin: user.isAdmin,
    isEmailVerified: user.isEmailVerified,
    phone: user.phone,
    country: user.country,
    totalEarned: user.totalEarned,
    pendingEarnings: user.pendingEarnings,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/admin/users", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { search } = req.query as { search?: string };
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }

    res.json(users.map(toAdminUser));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id/ban", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const { banned } = req.body ?? {};
    if (!Number.isSafeInteger(id) || typeof banned !== "boolean") {
      res.status(400).json({ error: "Invalid user or ban status." });
      return;
    }
    if (id === req.userId) {
      res.status(400).json({ error: "You cannot change your own access status." });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ error: "User not found." }); return; }
    if (target.isAdmin && banned) {
      res.status(400).json({ error: "Remove admin access before banning an administrator." });
      return;
    }
    const [user] = await db.update(usersTable).set({ isBanned: banned })
      .where(eq(usersTable.id, id)).returning();
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: banned ? "user_banned" : "user_unbanned",
      targetType: "user",
      targetId: id,
      details: { email: user.email },
    });
    res.json(toAdminUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const body = req.body ?? {};
    if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid user." }); return; }
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!current) { res.status(404).json({ error: "User not found." }); return; }
    if (id === req.userId && (body.isAdmin === false || body.isBanned === true)) {
      res.status(400).json({ error: "You cannot remove your own administrator access or ban yourself." });
      return;
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 100) {
        res.status(400).json({ error: "Name must be between 2 and 100 characters." }); return;
      }
      updates.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254) {
        res.status(400).json({ error: "Enter a valid email address." }); return;
      }
      updates.email = body.email.trim().toLowerCase();
    }
    for (const key of ["phone", "country"] as const) {
      if (body[key] !== undefined) {
        if (body[key] !== null && (typeof body[key] !== "string" || body[key].length > 120)) {
          res.status(400).json({ error: `Invalid ${key}.` }); return;
        }
        updates[key] = body[key] === null ? null : body[key].trim() || null;
      }
    }
    if (body.level !== undefined) {
      if (!Number.isInteger(body.level) || body.level < 1 || body.level > 7) { res.status(400).json({ error: "Level must be from 1 to 7." }); return; }
      updates.level = body.level;
    }
    for (const key of ["isAdmin", "isBanned", "isEmailVerified"] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "boolean") { res.status(400).json({ error: `Invalid ${key} value.` }); return; }
        updates[key] = body[key];
      }
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No account fields were provided." }); return; }
    if (updates.isBanned && (updates.isAdmin ?? current.isAdmin)) {
      res.status(400).json({ error: "Remove administrator access before banning this account." }); return;
    }
    if (updates.email) {
      const [existingEmail] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.email, updates.email), ne(usersTable.id, id)));
      if (existingEmail) { res.status(409).json({ error: "That email address is already used by another account." }); return; }
    }

    const result = await db.transaction(async (tx) => {
      const [lockedCurrent] = await tx.select().from(usersTable).where(eq(usersTable.id, id)).for("update");
      if (!lockedCurrent) return { error: "User not found.", status: 404 as const };
      if (updates.isAdmin === false && lockedCurrent.isAdmin) {
        const admins = await tx.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.isAdmin, true)).for("update");
        if (admins.length <= 1) return { error: "At least one administrator must remain.", status: 400 as const };
      }
      if (updates.isBanned && (updates.isAdmin ?? lockedCurrent.isAdmin)) {
        return { error: "Remove administrator access before banning this account.", status: 400 as const };
      }
      const [updated] = await tx.update(usersTable).set({ ...updates, updatedAt: new Date() })
        .where(eq(usersTable.id, id)).returning();
      const changes = Object.fromEntries(Object.entries(updates).map(([key, value]) => [
        key,
        { from: lockedCurrent[key as keyof typeof lockedCurrent], to: value },
      ]));
      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: "user_account_updated",
        targetType: "user",
        targetId: id,
        details: { changes },
      });
      return { updated };
    });
    if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
    res.json(toAdminUser(result.updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not update account." });
  }
});

router.post("/admin/users/:id/balance-adjustments", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const amount = Number(req.body?.amount);
    const reason = req.body?.reason;
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isFinite(amount) || amount === 0 ||
        Math.abs(amount) > 10_000 || typeof reason !== "string" || reason.trim().length < 5 || reason.length > 500) {
      res.status(400).json({ error: "Use a non-zero adjustment up to $10,000 and provide a reason of at least 5 characters." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, id)).for("update");
      if (!user) return null;
      const roundedAmount = Math.round(amount * 100) / 100;
      if (user.balance + roundedAmount < 0) return "negative" as const;
      const [updated] = await tx.update(usersTable).set({
        balance: sql`${usersTable.balance} + ${roundedAmount}`,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, id)).returning();
      await tx.insert(transactionsTable).values({
        userId: id,
        type: "admin_adjustment",
        amount: roundedAmount,
        status: "completed",
        description: `Admin adjustment ${roundedAmount > 0 ? "+" : ""}$${roundedAmount.toFixed(2)} — ${reason.trim()} (admin #${req.userId})`,
      });
      await tx.insert(notificationsTable).values({
        userId: id,
        type: "account_adjustment",
        title: "Wallet balance adjusted",
        message: `An administrator adjusted your wallet by ${roundedAmount > 0 ? "+" : ""}$${roundedAmount.toFixed(2)}. Reason: ${reason.trim()}`,
      });
      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: "user_balance_adjusted",
        targetType: "user",
        targetId: id,
        details: { amount: roundedAmount, reason: reason.trim() },
      });
      return updated;
    });
    if (!result) { res.status(404).json({ error: "User not found." }); return; }
    if (result === "negative") { res.status(400).json({ error: "An adjustment cannot make the wallet balance negative." }); return; }
    res.json(toAdminUser(result));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not adjust wallet balance." });
  }
});

router.get("/admin/tasks", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.taskType, "written"))
      .orderBy(desc(tasksTable.createdAt));
    res.json(tasks);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/tasks", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, description, category, reward, estimatedMinutes, difficulty, minLevel, instructions, isActive } = req.body;
    const fundingBudget = Number(req.body?.fundingBudget);
    const maxCompletions = Number(req.body?.maxCompletions);
    if (typeof title !== "string" || title.trim().length < 5 || title.length > 160 ||
        typeof description !== "string" || description.trim().length < 10 ||
        !ALLOWED_WORK_CATEGORIES.has(category) || !Number.isFinite(reward) || reward <= 0 ||
        !Number.isFinite(fundingBudget) || fundingBudget <= 0 || !Number.isInteger(maxCompletions) ||
        maxCompletions < 1 || maxCompletions > 500 || fundingBudget + 0.000001 < reward * maxCompletions ||
        !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440 ||
        difficulty !== "hard" || !Number.isInteger(minLevel) || minLevel < 1 || minLevel > 7 ||
        typeof instructions !== "string" || instructions.trim().length < 50 || instructions.length > 10000) {
      res.status(400).json({ error: "Tasks must be expert-level and include clear instructions, a category, reward, budget, and valid completion cap. Budget must cover every available reward." });
      return;
    }
    const [task] = await db.insert(tasksTable).values({
      title: title.trim(),
      description: description.trim(),
      category,
      taskType: "written",
      reward: Math.round(reward * 100) / 100,
      fundingBudget: Math.round(fundingBudget * 100) / 100,
      maxCompletions,
      estimatedMinutes,
      difficulty: "hard",
      minLevel,
      instructions: instructions.trim(),
      isActive: isActive === true,
    }).returning();
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_created",
      targetType: "task",
      targetId: task.id,
      details: { title: task.title, fundingBudget: task.fundingBudget, reward: task.reward, maxCompletions: task.maxCompletions, isActive: task.isActive },
    });
    res.status(201).json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/tasks/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const body = req.body ?? {};
    const [current] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!current || current.taskType !== "written") { res.status(404).json({ error: "Work listing not found." }); return; }
    const reward = body.reward === undefined ? current.reward : Number(body.reward);
    const fundingBudget = body.fundingBudget === undefined ? current.fundingBudget : Number(body.fundingBudget);
    const maxCompletions = body.maxCompletions === undefined ? current.maxCompletions : Number(body.maxCompletions);
    if (!Number.isFinite(reward) || reward <= 0 || !Number.isFinite(fundingBudget) || fundingBudget <= 0 ||
        !Number.isInteger(maxCompletions) || maxCompletions < 1 || maxCompletions > 500 ||
        fundingBudget + 0.000001 < reward * maxCompletions ||
        (body.difficulty !== undefined && body.difficulty !== "hard") ||
        (body.category !== undefined && !ALLOWED_WORK_CATEGORIES.has(body.category))) {
      res.status(400).json({ error: "Task difficulty must remain expert-level and the budget must cover all capped rewards." });
      return;
    }
    if (body.description !== undefined && (typeof body.description !== "string" || body.description.trim().length < 10 || body.description.length > 3000)) {
      res.status(400).json({ error: "Task description must be between 10 and 3,000 characters." }); return;
    }
    if (body.estimatedMinutes !== undefined && (!Number.isInteger(body.estimatedMinutes) || body.estimatedMinutes < 1 || body.estimatedMinutes > 1440)) {
      res.status(400).json({ error: "Estimated time must be between 1 and 1,440 minutes." }); return;
    }
    if (body.minLevel !== undefined && (!Number.isInteger(body.minLevel) || body.minLevel < 1 || body.minLevel > 7)) {
      res.status(400).json({ error: "Minimum level must be from 1 to 7." }); return;
    }
    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      res.status(400).json({ error: "Task active status must be true or false." }); return;
    }
    const reservedSubmissions = await db.select({ id: taskSubmissionsTable.id }).from(taskSubmissionsTable)
      .where(and(
        eq(taskSubmissionsTable.taskId, id),
        or(eq(taskSubmissionsTable.status, "submitted"), eq(taskSubmissionsTable.status, "approved")),
      ));
    if (reservedSubmissions.length > maxCompletions ||
        fundingBudget + 0.000001 < reward * reservedSubmissions.length) {
      res.status(400).json({ error: "Updated budget and completion cap must still cover already submitted and approved work." });
      return;
    }
    const updates: Partial<typeof tasksTable.$inferInsert> = {
      reward: Math.round(reward * 100) / 100,
      fundingBudget: Math.round(fundingBudget * 100) / 100,
      maxCompletions,
      updatedAt: new Date(),
    };
    for (const key of ["title", "description", "category", "instructions", "estimatedMinutes", "minLevel", "isActive"] as const) {
      if (body[key] !== undefined) (updates as Record<string, unknown>)[key] = body[key];
    }
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 5)) {
      res.status(400).json({ error: "Task title is too short." }); return;
    }
    if (body.instructions !== undefined && (typeof body.instructions !== "string" || body.instructions.trim().length < 50)) {
      res.status(400).json({ error: "Instructions must include at least 50 characters." }); return;
    }
    const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_updated",
      targetType: "task",
      targetId: id,
      details: { changedFields: Object.keys(body) },
    });
    res.json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/tasks/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    await db.update(tasksTable).set({ isActive: false }).where(and(eq(tasksTable.id, id), eq(tasksTable.taskType, "written")));
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_deactivated",
      targetType: "task",
      targetId: id,
      details: {},
    });
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
    const id = parseInt(String(req.params["id"]));
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
    const id = parseInt(String(req.params["id"]));
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

router.get("/admin/audit-log", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requestedLimit = Number(req.query.limit ?? 100);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) {
      res.status(400).json({ error: "Limit must be between 1 and 200." });
      return;
    }
    const rows = await db.select({
      log: adminAuditLogsTable,
      adminName: usersTable.name,
    }).from(adminAuditLogsTable)
      .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
      .orderBy(desc(adminAuditLogsTable.createdAt))
      .limit(requestedLimit);
    res.json(rows.map(({ log, adminName }) => ({
      id: log.id,
      adminUserId: log.adminUserId,
      adminName: adminName ?? "Removed administrator",
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details ?? {},
      createdAt: log.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not load the audit log." });
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

router.get("/admin/completions", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: userTasksTable.id,
        userId: userTasksTable.userId,
        taskId: userTasksTable.taskId,
        status: userTasksTable.status,
        startedAt: userTasksTable.startedAt,
        completedAt: userTasksTable.completedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        taskTitle: tasksTable.title,
        reward: tasksTable.reward,
      })
      .from(userTasksTable)
      .leftJoin(usersTable, eq(userTasksTable.userId, usersTable.id))
      .leftJoin(tasksTable, eq(userTasksTable.taskId, tasksTable.id))
      .orderBy(userTasksTable.startedAt);

    res.json(rows.map(r => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })));
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
