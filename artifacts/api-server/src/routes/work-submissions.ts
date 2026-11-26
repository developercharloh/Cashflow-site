import { Router } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  adminAuditLogsTable,
  db,
  notificationsTable,
  taskBidsTable,
  taskSubmissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  AdminGetTaskSubmissionsQueryParams,
  AdminGetTaskSubmissionsResponse,
  AdminReviewTaskSubmissionBody,
  AdminReviewTaskSubmissionParams,
  AdminReviewTaskSubmissionResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { createTaskUploadUrl, getTaskFileMetadata, streamTaskFile } from "../lib/taskFileStorage";
import { getLevelName } from "./auth";

const router = Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "image/jpeg",
  "image/png",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

async function getAssignmentEligibility(taskId: number, userId: number): Promise<"open" | "expired" | "unassigned"> {
  const [bid] = await db.select().from(taskBidsTable)
    .where(and(
      eq(taskBidsTable.taskId, taskId),
      eq(taskBidsTable.userId, userId),
    ));
  if (bid?.status === "expired") return "expired";
  if (!bid || bid.status !== "assigned" || !bid.deadlineAt) return "unassigned";
  if (bid.deadlineAt.getTime() > Date.now()) return "open";
  await db.update(taskBidsTable).set({
    status: "expired",
    reviewNote: "The deadline passed before work was submitted.",
    updatedAt: new Date(),
  }).where(and(eq(taskBidsTable.id, bid.id), eq(taskBidsTable.status, "assigned")));
  return "expired";
}

router.post("/tasks/work-submissions/upload-url", (req, res, next) => {
  if (req.body?.type === "blob.upload-completed") {
    next();
    return;
  }
  requireAuth(req as AuthRequest, res, next);
}, async (req: AuthRequest, res) => {
  try {
    if (req.body?.type) {
      if (process.env.VERCEL !== "1" && !process.env.BLOB_READ_WRITE_TOKEN) {
        res.status(400).json({ error: "Direct file uploads are unavailable in this environment." });
        return;
      }

      const result = await handleUpload({
        body: req.body as HandleUploadBody,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const expectedPrefix = `uploads/task-submissions/${req.userId}/`;
          if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
            throw new Error("Invalid upload destination.");
          }
          const payload = JSON.parse(clientPayload || "{}") as {
            taskId?: unknown;
            name?: unknown;
            contentType?: unknown;
            size?: unknown;
          };
          if (!Number.isSafeInteger(payload.taskId) || Number(payload.taskId) < 1 ||
              typeof payload.name !== "string" || payload.name.trim().length < 1 ||
              payload.name.length > 180 || typeof payload.contentType !== "string" ||
              !ALLOWED_FILE_TYPES.has(payload.contentType) || !Number.isInteger(payload.size) ||
              Number(payload.size) < 1 || Number(payload.size) > MAX_FILE_SIZE) {
            throw new Error("The file details are invalid.");
          }
          const eligibility = await getAssignmentEligibility(Number(payload.taskId), req.userId!);
          if (eligibility !== "open") {
            throw new Error(eligibility === "expired"
              ? "The task deadline has passed. Late work cannot be submitted."
              : "You need an active task assignment before uploading work.");
          }
          return {
            allowedContentTypes: [payload.contentType],
            maximumSizeInBytes: MAX_FILE_SIZE,
            tokenPayload: JSON.stringify({ userId: req.userId!, taskId: Number(payload.taskId), uploadedAt: Date.now() }),
          };
        },
      });
      res.json(result);
      return;
    }

    const { taskId, name, size, contentType } = req.body ?? {};
    if (!Number.isSafeInteger(taskId) || taskId < 1 ||
        typeof name !== "string" || name.trim().length < 1 || name.length > 180 ||
        !Number.isInteger(size) || size < 1 || size > MAX_FILE_SIZE ||
        typeof contentType !== "string" || !ALLOWED_FILE_TYPES.has(contentType)) {
      res.status(400).json({ error: "File must be up to 10 MB and use a supported document, image, CSV, text, or audio format." });
      return;
    }
    const eligibility = await getAssignmentEligibility(taskId, req.userId!);
    if (eligibility !== "open") {
      res.status(eligibility === "expired" ? 410 : 403).json({
        error: eligibility === "expired"
          ? "The task deadline has passed. Late work cannot be submitted."
          : "You need an active task assignment before uploading work.",
      });
      return;
    }
    const upload = await createTaskUploadUrl(req.userId!);
    if (upload.provider === "vercel") {
      res.json(upload);
      return;
    }
    res.json({ provider: "replit", uploadURL: upload.uploadURL, objectPath: upload.objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Could not create task work upload");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("active task assignment")) {
      res.status(403).json({ error: "You need an active task assignment before uploading work." });
      return;
    }
    if (message.includes("task deadline has passed")) {
      res.status(410).json({ error: "The task deadline has passed. Late work cannot be submitted." });
      return;
    }
    res.status(500).json({ error: "File uploads are unavailable right now." });
  }
});

router.post("/tasks/:id/work-submissions", requireAuth, async (req: AuthRequest, res) => {
  const taskId = Number(req.params["id"]);
  const userId = req.userId!;
  const { textSubmission, attachmentPath, attachmentName, attachmentContentType, attachmentSize } = req.body ?? {};
  if (!Number.isSafeInteger(taskId) || taskId < 1) {
    res.status(400).json({ error: "Invalid task." });
    return;
  }
  if (typeof textSubmission !== "undefined" &&
      (typeof textSubmission !== "string" || textSubmission.length > 50_000)) {
    res.status(400).json({ error: "Written response must be 50,000 characters or fewer." });
    return;
  }
  const text = typeof textSubmission === "string" ? textSubmission.trim() : "";
  const hasAttachment = typeof attachmentPath === "string";
  if (text.length < 50 && !hasAttachment) {
    res.status(400).json({ error: "Write at least 50 characters or attach a work file." });
    return;
  }
  if (hasAttachment) {
    const prefix = `/objects/uploads/task-submissions/${userId}/`;
    if (!attachmentPath.startsWith(prefix) || typeof attachmentName !== "string" ||
        attachmentName.length < 1 || attachmentName.length > 180 ||
        typeof attachmentContentType !== "string" || !ALLOWED_FILE_TYPES.has(attachmentContentType) ||
        !Number.isInteger(attachmentSize) || attachmentSize < 1 || attachmentSize > MAX_FILE_SIZE) {
      res.status(400).json({ error: "The uploaded file details are invalid. Upload it again and retry." });
      return;
    }
  }

  try {
    let verifiedFile: { size: number; contentType: string } | null = null;
    if (hasAttachment) {
      verifiedFile = await getTaskFileMetadata(attachmentPath);
      if (!verifiedFile || verifiedFile.size < 1 || verifiedFile.size > MAX_FILE_SIZE ||
          !ALLOWED_FILE_TYPES.has(verifiedFile.contentType)) {
        res.status(400).json({ error: "Uploaded file is missing, too large, or not a supported type. Upload a valid file and retry." });
        return;
      }
    }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${taskId})`);
      const [task] = await tx.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      if (!task || task.taskType !== "written") return { error: "This work listing is not available.", status: 404 as const };
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId));
      if (!user || user.level < task.minLevel) return { error: "Your account does not meet this task's level requirement.", status: 403 as const };

      const [bid] = await tx.select().from(taskBidsTable)
        .where(and(
          eq(taskBidsTable.taskId, taskId),
          eq(taskBidsTable.userId, userId),
        )).for("update");
      if (!bid || bid.status !== "assigned" || !bid.deadlineAt) {
        return { error: "This task has not been assigned to you.", status: 403 as const };
      }
      if (bid.deadlineAt.getTime() <= Date.now()) {
        await tx.update(taskBidsTable).set({
          status: "expired",
          reviewNote: "The deadline passed before work was submitted.",
          updatedAt: new Date(),
        }).where(eq(taskBidsTable.id, bid.id));
        return { error: "The task deadline has passed. Late work cannot be submitted.", status: 410 as const };
      }

      const existingMine = await tx.select({ id: taskSubmissionsTable.id }).from(taskSubmissionsTable)
        .where(eq(taskSubmissionsTable.bidId, bid.id));
      if (existingMine.length > 0) {
        return { error: "Work has already been submitted for this assignment.", status: 409 as const };
      }

      const [submission] = await tx.insert(taskSubmissionsTable).values({
        taskId,
        userId,
        bidId: bid.id,
        status: "submitted",
        textSubmission: text || null,
        attachmentPath: hasAttachment ? attachmentPath : null,
        attachmentName: hasAttachment ? attachmentName.trim().replace(/[\\/]/g, "_") : null,
        attachmentContentType: verifiedFile?.contentType ?? null,
        attachmentSize: verifiedFile?.size ?? null,
      }).returning();
      await tx.update(taskBidsTable).set({
        status: "submitted",
        updatedAt: new Date(),
      }).where(eq(taskBidsTable.id, bid.id));
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
    const query = AdminGetTaskSubmissionsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const status = query.data.status;
    const allowedStatuses = new Set(["submitted", "approved", "rejected"]);
    if (status && status !== "all" && !allowedStatuses.has(status)) {
      res.status(400).json({ error: "Invalid submission status." });
      return;
    }
    const rows = await db.select({
      submission: taskSubmissionsTable,
      taskTitle: tasksTable.title,
      reward: tasksTable.reward,
      taskDescription: tasksTable.description,
      taskInstructions: tasksTable.instructions,
      taskAssetUrl: tasksTable.assetUrl,
      reviewGuide: tasksTable.reviewGuide,
      userName: usersTable.name,
      userEmail: usersTable.email,
    }).from(taskSubmissionsTable)
      .innerJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
      .innerJoin(usersTable, eq(taskSubmissionsTable.userId, usersTable.id))
      .orderBy(desc(taskSubmissionsTable.submittedAt))
      .limit(200);
    res.json(AdminGetTaskSubmissionsResponse.parse(rows
      .filter(({ submission }) => !status || status === "all" || submission.status === status)
      .map(({ submission, taskTitle, reward, taskDescription, taskInstructions, taskAssetUrl, reviewGuide, userName, userEmail }) => ({
        id: submission.id,
        taskId: submission.taskId,
        taskTitle,
        reward,
        taskDescription,
        taskInstructions,
        taskAssetUrl,
        reviewGuide,
        status: submission.status,
        textSubmission: submission.textSubmission,
        attachmentName: submission.attachmentName,
        attachmentPath: submission.attachmentPath,
        reviewNote: submission.reviewNote,
        submittedAt: submission.submittedAt.toISOString(),
        userId: submission.userId,
        userName,
        userEmail,
      }))));
  } catch (error) {
    req.log.error({ err: error }, "Could not load admin review queue");
    res.status(500).json({ error: "Could not load work submissions." });
  }
});

router.patch("/admin/task-submissions/:id/review", requireAdmin, async (req: AuthRequest, res) => {
  const params = AdminReviewTaskSubmissionParams.safeParse(req.params);
  const input = AdminReviewTaskSubmissionBody.safeParse(req.body);
  if (!params.success || !input.success) {
    res.status(400).json({ error: "Choose approve or reject and enter a review note." });
    return;
  }
  const submissionId = params.data.id;
  const { decision, note } = input.data;
  if (!Number.isSafeInteger(submissionId) || submissionId < 1 || note.trim().length < 3 || note.length > 1000) {
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
      if (submission.bidId !== null) {
        await tx.update(taskBidsTable).set({
          status: decision === "approved" ? "completed" : "rejected",
          reviewNote: note.trim(),
          updatedAt: new Date(),
        }).where(eq(taskBidsTable.id, submission.bidId));
      }
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
    res.json(AdminReviewTaskSubmissionResponse.parse({
      id: result.submission.id,
      taskId: result.task.id,
      taskTitle: result.task.title,
      reward: result.task.reward,
      taskDescription: result.task.description,
      taskInstructions: result.task.instructions,
      taskAssetUrl: result.task.assetUrl,
      reviewGuide: result.task.reviewGuide,
      status: result.submission.status,
      textSubmission: result.submission.textSubmission,
      attachmentName: result.submission.attachmentName,
      attachmentPath: result.submission.attachmentPath,
      reviewNote: result.submission.reviewNote,
      submittedAt: result.submission.submittedAt.toISOString(),
      userId: result.user.id,
      userName: result.user.name,
      userEmail: result.user.email,
    }));
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
    const found = await streamTaskFile(submission.attachmentPath, res);
    if (!found) res.status(404).json({ error: "File not found." });
  } catch (error) {
    req.log.error({ err: error }, "Could not serve task attachment");
    if (!res.headersSent) res.status(500).json({ error: "Could not load the attachment." });
  }
});

export default router;
