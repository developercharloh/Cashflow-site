import { Router } from "express";
import { db, usersTable, tasksTable, userTasksTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";

const router = Router();

router.get("/tasks/categories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));
    const map: Record<string, { count: number; totalReward: number }> = {};
    for (const t of tasks) {
      if (!map[t.category]) map[t.category] = { count: 0, totalReward: 0 };
      map[t.category].count++;
      map[t.category].totalReward += t.reward;
    }
    res.json(Object.entries(map).map(([name, v]) => ({ name, count: v.count, totalReward: v.totalReward })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category } = req.query as { category?: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));
    const completedIds = new Set(
      (await db.select({ taskId: userTasksTable.taskId }).from(userTasksTable)
        .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.status, "completed"))))
        .map(r => r.taskId)
    );

    let tasks = allTasks.filter(t => t.minLevel <= user.level);
    if (category) tasks = tasks.filter(t => t.category === category);

    res.json(tasks.map(t => ({
      ...t,
      completedByUser: completedIds.has(t.id),
      createdAt: undefined,
      updatedAt: undefined,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks/:id/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task || !task.isActive) { res.status(404).json({ error: "Task not found" }); return; }

    // Check transcription minutes
    if (task.taskType === "transcription" && task.minutesCost) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
      if (user.transcriptionMinutes < task.minutesCost) {
        res.status(400).json({
          error: `This task requires ${task.minutesCost} transcription minutes. You have ${user.transcriptionMinutes.toFixed(1)} minutes. Please purchase more.`,
          requiresMinutes: true,
          minutesNeeded: task.minutesCost,
        });
        return;
      }
    }

    const [existing] = await db.select().from(userTasksTable)
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    if (existing?.status === "completed") { res.status(400).json({ error: "Task already completed" }); return; }
    if (existing) { res.json(existing); return; }

    const [ut] = await db.insert(userTasksTable).values({
      userId: req.userId!,
      taskId: id,
      status: "started",
    }).returning();
    res.json({ ...ut, timeLimitSeconds: task.timeLimitSeconds });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (task.minLevel > user.level) {
      res.status(400).json({ error: "Insufficient membership level" }); return;
    }

    // Level 1 (Starter) daily limit: 2 tasks per day
    if (user.level === 1) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCompletions = await db.select().from(userTasksTable)
        .where(and(
          eq(userTasksTable.userId, req.userId!),
          eq(userTasksTable.status, "completed"),
          gte(userTasksTable.completedAt, todayStart)
        ));
      if (todayCompletions.length >= 2) {
        res.status(403).json({
          error: "You've completed both free tasks for today. Upgrade your membership to unlock unlimited tasks and earn more.",
          limitReached: true,
        });
        return;
      }
    }

    const [existing] = await db.select().from(userTasksTable)
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id), eq(userTasksTable.status, "completed")));
    if (existing) {
      res.status(400).json({ error: "Task already completed" }); return;
    }

    // Validate time limit
    const [inProgress] = await db.select().from(userTasksTable)
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    if (inProgress && task.timeLimitSeconds) {
      const elapsed = (Date.now() - new Date(inProgress.startedAt).getTime()) / 1000;
      if (elapsed > task.timeLimitSeconds + 30) { // 30s grace
        res.status(400).json({ error: "Time limit exceeded. Task expired." });
        return;
      }
    }

    // Deduct transcription minutes
    if (task.taskType === "transcription" && task.minutesCost) {
      if (user.transcriptionMinutes < task.minutesCost) {
        res.status(400).json({ error: "Insufficient transcription minutes" }); return;
      }
      await db.update(usersTable).set({
        transcriptionMinutes: user.transcriptionMinutes - task.minutesCost,
      }).where(eq(usersTable.id, req.userId!));
    }

    const reward = task.reward;
    const newBalance = user.balance + reward;
    const newCompleted = user.tasksCompleted + 1;
    const newTotalEarned = user.totalEarned + reward;
    const newTaskEarnings = user.totalTaskEarnings + reward;

    let newLevel = user.level;
    if (newTotalEarned >= 5000) newLevel = 7;
    else if (newTotalEarned >= 2000) newLevel = 6;
    else if (newTotalEarned >= 1000) newLevel = 5;
    else if (newTotalEarned >= 500) newLevel = 4;
    else if (newTotalEarned >= 200) newLevel = 3;
    else if (newTotalEarned >= 50) newLevel = 2;

    await db.update(usersTable).set({
      balance: newBalance,
      tasksCompleted: newCompleted,
      totalEarned: newTotalEarned,
      totalTaskEarnings: newTaskEarnings,
      level: newLevel,
    }).where(eq(usersTable.id, req.userId!));

    await db.update(userTasksTable).set({ status: "completed", completedAt: new Date() })
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));

    await db.update(tasksTable).set({ completionCount: task.completionCount + 1 }).where(eq(tasksTable.id, id));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "earning",
      amount: reward,
      status: "completed",
      description: `Completed: ${task.title}`,
    });

    if (newLevel > user.level) {
      await db.insert(notificationsTable).values({
        userId: req.userId!,
        type: "level_up",
        title: "Level Up!",
        message: `Congratulations! You've reached ${getLevelName(newLevel)} level.`,
      });
    }

    res.json({
      success: true,
      rewardEarned: reward,
      message: `You earned $${reward.toFixed(2)} for completing ${task.title}!`,
      newBalance,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks/daily-checkin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const now = new Date();
    if (user.lastCheckIn) {
      const lastDate = new Date(user.lastCheckIn);
      const sameDay = lastDate.toDateString() === now.toDateString();
      if (sameDay) { res.status(400).json({ error: "Already checked in today" }); return; }
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = user.lastCheckIn && new Date(user.lastCheckIn).toDateString() === yesterday.toDateString();
    const streak = wasYesterday ? user.streakDays + 1 : 1;
    // Starter (level 1): fixed $0.15 check-in; higher levels earn streak bonuses
    const reward = user.level === 1 ? 0.15 : Math.min(0.5 + (streak - 1) * 0.1, 2.0);

    await db.update(usersTable).set({
      balance: user.balance + reward,
      totalBonusEarnings: user.totalBonusEarnings + reward,
      totalEarned: user.totalEarned + reward,
      lastCheckIn: now,
      streakDays: streak,
    }).where(eq(usersTable.id, req.userId!));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "bonus",
      amount: reward,
      status: "completed",
      description: `Daily check-in (Day ${streak} streak)`,
    });

    res.json({ success: true, rewardEarned: reward, streakDays: streak, message: `Day ${streak} streak! Earned $${reward.toFixed(2)}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
