import { Router } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  adminAuditLogsTable,
  db,
  notificationsTable,
  taskSubmissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { streamTaskFile } from "../lib/taskFileStorage";
import { getLevelName } from "./auth";

const router = Router();

router.post("/tasks/work-submissions/upload-url", requireAuth, (_req, res): void => {
  res.status(410).json({ error: "File submissions are temporarily unavailable. Submit your work as text." });
});

router.post("/tasks/:id/work-submissions", requireAuth, async (req: AuthRequest, res) => {
  const taskId = Number(req.params["id"]);
  const userId = req.userId!;
  const { textSubmission } = req.body ?? {};
  if (!Number.isSafeInteger(taskId) || taskId < 1) {
    res.status(400).json({ error: "Invalid task." });
    return;
  }
  if (["attachmentPath", "attachmentName", "attachmentContentType", "attachmentSize"]
    .some((field) => req.body && Object.hasOwn(req.body, field) && req.body[field] != null)) {
    res.status(400).json({ error: "File submissions are temporarily unavailable. Submit your work as text." });
    return;
  }
  if (typeof textSubmission !== "undefined" &&
      (typeof textSubmission !== "string" || textSubmission.length > 50_000)) {
    res.status(400).json({ error: "Written response must be 50,000 characters or fewer." });
    return;
  }
  const text = typeof textSubmission === "string" ? textSubmission.trim() : "";
  if (text.length < 50) {
    res.status(400).json({ error: "Write at least 50 characters to submit your work." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${taskId})`);
      const [task] = await tx.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      if (!task || !task.isActive || task.taskType !== "written") return { error: "This work listing is not available.", status: 404 as const };
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId));
      if (!user || user.level < task.minLevel) return { error: "Your account does not meet this task's level requirement.", status: 403 as const };

      const existingMine = await tx.select({ id: taskSubmissionsTable.id }).from(taskSubmissionsTable)
        .where(and(
          eq(taskSubmissionsTable.taskId, taskId),
          eq(taskSubmissionsTable.userId, userId),
          or(eq(taskSubmissionsTable.status, "submitted"), eq(taskSubmissionsTable.status, "approved")),
        ));
      if (existingMine.length > 0) return { error: "You already have an active or approved submission for this task.", status: 409 as const };

      const reserved = await tx.select({ id: taskSubmissionsTable.id }).from(taskSubmissionsTable)
        .where(and(
          eq(taskSubmissionsTable.taskId, taskId),
          or(eq(taskSubmissionsTable.status, "submitted"), eq(taskSubmissionsTable.status, "approved")),
        ));
      if (reserved.length >= task.maxCompletions || reserved.length * task.reward + task.reward > task.fundingBudget + 0.000001) {
        return { error: "This funded task has reached its available places.", status: 409 as const };
      }

      const [submission] = await tx.insert(taskSubmissionsTable).values({
        taskId,
        userId,
        status: "submitted",
        textSubmission: text,
        attachmentPath: null,
        attachmentName: null,
        attachmentContentType: null,
        attachmentSize: null,
      }).returning();
      return { submission, task };
    });

    if ("error" in result) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      id: result.submission.id,
      taskId,
      taskTitle: result.task.title,
      reward: result.task.reward,
      status: result.submission.status,
      textSubmission: result.submission.textSubmission,
      attachmentName: result.submission.attachmentName,
      attachmentPath: result.submission.attachmentPath,
      reviewNote: result.submission.reviewNote,
      submittedAt: result.submission.submittedAt.toISOString(),
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not save task submission");
    res.status(500).json({ error: "Could not submit work right now." });
  }
});

router.get("/tasks/work-submissions/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select({
      submission: taskSubmissionsTable,
      taskTitle: tasksTable.title,
      reward: tasksTable.reward,
    }).from(taskSubmissionsTable)
      .innerJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
      .where(eq(taskSubmissionsTable.userId, req.userId!))
      .orderBy(desc(taskSubmissionsTable.submittedAt))
      .limit(100);
    res.json(rows.map(({ submission, taskTitle, reward }) => ({
      id: submission.id,
      taskId: submission.taskId,
      taskTitle,
      reward,
      status: submission.status,
      textSubmission: submission.textSubmission,
      attachmentName: submission.attachmentName,
      attachmentPath: submission.attachmentPath,
      reviewNote: submission.reviewNote,
      submittedAt: submission.submittedAt.toISOString(),
    })));
  } catch (error) {
    req.log.error({ err: error }, "Could not list task submissions");
    res.status(500).json({ error: "Could not load submissions." });
  }
});

router.get("/admin/task-submissions", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const allowedStatuses = new Set(["submitted", "approved", "rejected"]);
    if (status && status !== "all" && !allowedStatuses.has(status)) {
      res.status(400).json({ error: "Invalid submission status." });
      return;
    }
    const rows = await db.select({
      submission: taskSubmissionsTable,
      taskTitle: tasksTable.title,
      reward: tasksTable.reward,
      userName: usersTable.name,
      userEmail: usersTable.email,
    }).from(taskSubmissionsTable)
      .innerJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
      .innerJoin(usersTable, eq(taskSubmissionsTable.userId, usersTable.id))
      .orderBy(desc(taskSubmissionsTable.submittedAt))
      .limit(200);
    res.json(rows
      .filter(({ submission }) => !status || status === "all" || submission.status === status)
      .map(({ submission, taskTitle, reward, userName, userEmail }) => ({
        id: submission.id,
        taskId: submission.taskId,
        taskTitle,
        reward,
        status: submission.status,
        textSubmission: submission.textSubmission,
        attachmentName: submission.attachmentName,
        attachmentPath: submission.attachmentPath,
        reviewNote: submission.reviewNote,
        submittedAt: submission.submittedAt.toISOString(),
        userId: submission.userId,
        userName,
        userEmail,
      })));
  } catch (error) {
    req.log.error({ err: error }, "Could not load admin review queue");
    res.status(500).json({ error: "Could not load work submissions." });
  }
});

router.patch("/admin/task-submissions/:id/review", requireAdmin, async (req: AuthRequest, res) => {
  const submissionId = Number(req.params["id"]);
  const { decision, note } = req.body ?? {};
  if (!Number.isSafeInteger(submissionId) || submissionId < 1 ||
      !["approved", "rejected"].includes(decision) ||
      typeof note !== "string" || note.trim().length < 3 || note.length > 1000) {
    res.status(400).json({ error: "Choose approve or reject and enter a review note." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [submission] = await tx.select().from(taskSubmissionsTable)
        .where(eq(taskSubmissionsTable.id, submissionId)).for("update");
      if (!submission) return { error: "Submission not found.", status: 404 as const };
      if (submission.status !== "submitted") return { error: "This submission has already been reviewed.", status: 409 as const };
      const [task] = await tx.select().from(tasksTable).where(eq(tasksTable.id, submission.taskId)).for("update");
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, submission.userId)).for("update");
      if (!task || !user) return { error: "Task or user record is missing.", status: 404 as const };

      if (decision === "approved") {
        const approvedRows = await tx.select({ id: taskSubmissionsTable.id }).from(taskSubmissionsTable)
          .where(and(eq(taskSubmissionsTable.taskId, task.id), eq(taskSubmissionsTable.status, "approved")));
        if (approvedRows.length >= task.maxCompletions ||
            (approvedRows.length + 1) * task.reward > task.fundingBudget + 0.000001) {
          return { error: "The task budget or completion limit has been reached. Do not approve this submission.", status: 409 as const };
        }

        const totalEarned = user.totalEarned + task.reward;
        const level = totalEarned >= 5000 ? 7 : totalEarned >= 2000 ? 6 : totalEarned >= 1000 ? 5 :
          totalEarned >= 500 ? 4 : totalEarned >= 200 ? 3 : totalEarned >= 50 ? 2 : user.level;
        await tx.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${task.reward}`,
          totalEarned: sql`${usersTable.totalEarned} + ${task.reward}`,
          totalTaskEarnings: sql`${usersTable.totalTaskEarnings} + ${task.reward}`,
          tasksCompleted: sql`${usersTable.tasksCompleted} + 1`,
          level,
        }).where(eq(usersTable.id, user.id));
        await tx.update(tasksTable).set({ completionCount: sql`${tasksTable.completionCount} + 1` })
          .where(eq(tasksTable.id, task.id));
        await tx.insert(transactionsTable).values({
          userId: user.id,
          type: "earning",
          amount: task.reward,
          status: "completed",
          description: `Approved work: ${task.title}`,
        });
        await tx.insert(notificationsTable).values({
          userId: user.id,
          type: "task_review",
          title: "Task work approved",
          message: `Your submission for "${task.title}" was approved. $${task.reward.toFixed(2)} has been added to your wallet.`,
        });
        if (level > user.level) {
          await tx.insert(notificationsTable).values({
            userId: user.id,
            type: "level_up",
            title: "Level Up!",
            message: `Congratulations! You've reached ${getLevelName(level)} level.`,
          });
        }
      } else {
        await tx.insert(notificationsTable).values({
          userId: user.id,
          type: "task_review",
          title: "Task work needs changes",
          message: `Your submission for "${task.title}" was not approved: ${note.trim()}`,
        });
      }

      const [updated] = await tx.update(taskSubmissionsTable).set({
        status: decision,
        reviewNote: note.trim(),
        reviewedBy: req.userId!,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(taskSubmissionsTable.id, submission.id)).returning();
      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: `task_submission_${decision}`,
        targetType: "task_submission",
        targetId: submission.id,
        details: { taskId: task.id, userId: user.id, reward: decision === "approved" ? task.reward : 0, note: note.trim() },
      });
      return { submission: updated, task, user };
    });

    if ("error" in result) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.json({
      id: result.submission.id,
      taskId: result.task.id,
      taskTitle: result.task.title,
      reward: result.task.reward,
      status: result.submission.status,
      textSubmission: result.submission.textSubmission,
      attachmentName: result.submission.attachmentName,
      attachmentPath: result.submission.attachmentPath,
      reviewNote: result.submission.reviewNote,
      submittedAt: result.submission.submittedAt.toISOString(),
      userId: result.user.id,
      userName: result.user.name,
      userEmail: result.user.email,
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not review task work");
    res.status(500).json({ error: "Could not save the review." });
  }
});

router.get("/storage/task-submissions/:id/file", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid submission." });
      return;
    }
    const [submission] = await db.select().from(taskSubmissionsTable)
      .where(eq(taskSubmissionsTable.id, id));
    if (!submission?.attachmentPath) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    if (submission.userId !== req.userId && !req.isAdmin) {
      res.status(403).json({ error: "You do not have access to this file." });
      return;
    }
    if (process.env.VERCEL === "1" && !process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(503).json({ error: "File access is temporarily unavailable." });
      return;
    }
    const found = await streamTaskFile(submission.attachmentPath, res);
    if (!found) res.status(404).json({ error: "File not found." });
  } catch (error) {
    req.log.error({ err: error }, "Could not serve task attachment");
    if (!res.headersSent) res.status(500).json({ error: "Could not load the attachment." });
  }
});

export default router;
