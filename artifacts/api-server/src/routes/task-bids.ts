import { Router } from "express";
import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import {
  AdminGetTaskBidsQueryParams,
  AdminGetTaskBidsResponse,
  AdminReviewTaskBidBody,
  AdminReviewTaskBidResponse,
  GetMyTaskBidsResponse,
  SubmitTaskBidParams,
} from "@workspace/api-zod";
import {
  adminAuditLogsTable,
  db,
  notificationsTable,
  taskBidsTable,
  taskSubmissionsTable,
  tasksTable,
  userTasksTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

async function expireOverdueBids() {
  const now = new Date();
  await db.update(taskBidsTable).set({
    status: "expired",
    reviewNote: "The deadline passed before work was submitted.",
    updatedAt: now,
  }).where(and(
    eq(taskBidsTable.status, "assigned"),
    lte(taskBidsTable.deadlineAt, now),
  ));
}

router.get("/tasks/bids/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    await expireOverdueBids();
    const rows = await db.select({
      bid: taskBidsTable,
      taskTitle: tasksTable.title,
      deadlineHours: tasksTable.deadlineHours,
    }).from(taskBidsTable)
      .innerJoin(tasksTable, eq(taskBidsTable.taskId, tasksTable.id))
      .where(eq(taskBidsTable.userId, req.userId!))
      .orderBy(desc(taskBidsTable.bidAt))
      .limit(300);

    res.json(GetMyTaskBidsResponse.parse(rows.map(({ bid, taskTitle, deadlineHours }) => ({
      id: bid.id,
      taskId: bid.taskId,
      taskTitle,
      status: bid.status,
      bidAt: bid.bidAt.toISOString(),
      deadlineAt: bid.deadlineAt?.toISOString() ?? null,
      deadlineHours,
      reviewNote: bid.reviewNote,
    }))));
  } catch (error) {
    req.log.error({ err: error }, "Could not load task bids");
    res.status(500).json({ error: "Could not load your task bids right now." });
  }
});

router.post("/tasks/:id/bids", requireAuth, async (req: AuthRequest, res) => {
  const parsedParams = SubmitTaskBidParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid task." });
    return;
  }
  const taskId = parsedParams.data.id;

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${taskId})`);
      const [user] = await tx.select().from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .for("update");
      if (!user) return { error: "Account not found.", status: 404 as const };
      if (!["silver", "diamond", "legacy"].includes(user.taskPackage)) {
        return { error: "A task package is required before you can bid.", status: 403 as const };
      }

      const [task] = await tx.select().from(tasksTable)
        .where(eq(tasksTable.id, taskId))
        .for("update");
      if (!task || !task.isActive || task.taskType !== "written") {
        return { error: "This task is not available.", status: 404 as const };
      }
      if (user.level < task.minLevel) {
        return { error: `You need account level ${task.minLevel} to bid on this task.`, status: 403 as const };
      }

      const [existingBid] = await tx.select({ id: taskBidsTable.id })
        .from(taskBidsTable)
        .where(and(
          eq(taskBidsTable.taskId, taskId),
          eq(taskBidsTable.userId, user.id),
        ));
      if (existingBid) {
        return { error: "You have already bid on this task.", status: 409 as const };
      }

      const existingSubmissions = await tx.select({ id: taskSubmissionsTable.id })
        .from(taskSubmissionsTable)
        .where(and(
          eq(taskSubmissionsTable.taskId, taskId),
          or(
            eq(taskSubmissionsTable.status, "submitted"),
            eq(taskSubmissionsTable.status, "approved"),
          ),
        ));
      const assignedBids = await tx.select({ id: taskBidsTable.id })
        .from(taskBidsTable)
        .where(and(
          eq(taskBidsTable.taskId, taskId),
          eq(taskBidsTable.status, "assigned"),
        ));
      const reservedPlaces = existingSubmissions.length + assignedBids.length;
      if (reservedPlaces >= task.maxCompletions ||
          (reservedPlaces + 1) * task.reward > task.fundingBudget + 0.000001) {
        return { error: "This task has no funded places available.", status: 409 as const };
      }

      const [bid] = await tx.insert(taskBidsTable).values({
        taskId,
        userId: user.id,
        status: "pending",
      }).returning();
      return { bid, task };
    });

    if ("error" in result) {
      res.status(result.status ?? 409).json({ error: result.error });
      return;
    }
    res.status(201).json(GetMyTaskBidsResponse.parse([{
      id: result.bid.id,
      taskId: result.task.id,
      taskTitle: result.task.title,
      status: result.bid.status,
      bidAt: result.bid.bidAt.toISOString(),
      deadlineAt: null,
      deadlineHours: result.task.deadlineHours,
      reviewNote: null,
    }])[0]);
  } catch (error) {
    req.log.error({ err: error }, "Could not submit task bid");
    res.status(500).json({ error: "Your bid could not be submitted. Please try again." });
  }
});

router.get("/admin/task-bids", requireAdmin, async (req: AuthRequest, res) => {
  const query = AdminGetTaskBidsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid bid filter." });
    return;
  }
  try {
    await expireOverdueBids();
    const conditions = query.data.status && query.data.status !== "all"
      ? [eq(taskBidsTable.status, query.data.status)]
      : [];
    const rows = await db.select({
      bid: taskBidsTable,
      taskTitle: tasksTable.title,
      category: tasksTable.category,
      reward: tasksTable.reward,
      deadlineHours: tasksTable.deadlineHours,
      userName: usersTable.name,
      userEmail: usersTable.email,
    }).from(taskBidsTable)
      .innerJoin(tasksTable, eq(taskBidsTable.taskId, tasksTable.id))
      .innerJoin(usersTable, eq(taskBidsTable.userId, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(taskBidsTable.bidAt))
      .limit(500);

    res.json(AdminGetTaskBidsResponse.parse(rows.map(({ bid, taskTitle, category, reward, deadlineHours, userName, userEmail }) => ({
      id: bid.id,
      taskId: bid.taskId,
      taskTitle,
      category,
      reward,
      deadlineHours,
      userId: bid.userId,
      userName,
      userEmail,
      status: bid.status,
      bidAt: bid.bidAt.toISOString(),
      deadlineAt: bid.deadlineAt?.toISOString() ?? null,
      reviewNote: bid.reviewNote,
    }))));
  } catch (error) {
    req.log.error({ err: error }, "Could not load admin task bids");
    res.status(500).json({ error: "Could not load task bids right now." });
  }
});

router.patch("/admin/task-bids/:id/review", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  const input = AdminReviewTaskBidBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !input.success) {
    res.status(400).json({ error: "Enter a valid bid decision." });
    return;
  }
  const note = typeof input.data.note === "string" ? input.data.note.trim() : "";

  try {
    const result = await db.transaction(async (tx) => {
      const [bid] = await tx.select().from(taskBidsTable)
        .where(eq(taskBidsTable.id, id))
        .for("update");
      if (!bid || bid.status !== "pending") {
        return { error: "This bid is no longer waiting for a decision.", httpStatus: 409 as const };
      }
      const [task] = await tx.select().from(tasksTable)
        .where(eq(tasksTable.id, bid.taskId))
        .for("update");
      if (!task) return { error: "Task not found.", httpStatus: 404 as const };
      if (input.data.decision === "assign" && !task.isActive) {
        return { error: "This task has been closed and cannot receive new assignments.", httpStatus: 409 as const };
      }

      const now = new Date();
      let status: "assigned" | "rejected" = input.data.decision === "assign" ? "assigned" : "rejected";
      let deadlineAt: Date | null = null;
      let reviewNote = note || null;

      if (input.data.decision === "assign") {
        const submissions = await tx.select({ id: taskSubmissionsTable.id })
          .from(taskSubmissionsTable)
          .where(and(
            eq(taskSubmissionsTable.taskId, task.id),
            or(
              eq(taskSubmissionsTable.status, "submitted"),
              eq(taskSubmissionsTable.status, "approved"),
            ),
          ));
        const otherAssignedBids = await tx.select({ id: taskBidsTable.id })
          .from(taskBidsTable)
          .where(and(
            eq(taskBidsTable.taskId, task.id),
            eq(taskBidsTable.status, "assigned"),
          ));
        const reservedPlaces = submissions.length + otherAssignedBids.length;
        if (reservedPlaces >= task.maxCompletions ||
            (reservedPlaces + 1) * task.reward > task.fundingBudget + 0.000001) {
          return { error: "All funded assignment places have been filled.", httpStatus: 409 as const };
        }

        deadlineAt = new Date(now.getTime() + task.deadlineHours * 60 * 60 * 1000);
        reviewNote = note || "Assigned";

        await tx.insert(userTasksTable).values({
          userId: bid.userId,
          taskId: task.id,
          status: "assigned",
        });
      } else {
        reviewNote = note || "This bid was not selected for this task.";
      }

      const [updatedBid] = await tx.update(taskBidsTable).set({
        status,
        reviewNote,
        reviewedBy: req.userId!,
        reviewedAt: now,
        deadlineAt,
        updatedAt: now,
      }).where(eq(taskBidsTable.id, bid.id)).returning();

      const [worker] = await tx.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, bid.userId));
      const isAssigned = status === "assigned";
      await tx.insert(notificationsTable).values({
        userId: bid.userId,
        type: isAssigned ? "task_assigned" : "task_bid_declined",
        title: isAssigned ? "Task assigned to you" : "Task bid update",
        message: isAssigned
          ? `Your bid for "${task.title}" was selected. Submit your work within ${task.deadlineHours} hours.`
          : `Your bid for "${task.title}" was not selected. ${reviewNote}`,
      });

      if (status === "assigned") {
        const afterAssignment = await tx.select({ id: taskSubmissionsTable.id })
          .from(taskSubmissionsTable)
          .where(and(
            eq(taskSubmissionsTable.taskId, task.id),
            or(
              eq(taskSubmissionsTable.status, "submitted"),
              eq(taskSubmissionsTable.status, "approved"),
            ),
          ));
        const otherAssignments = await tx.select({ id: taskBidsTable.id })
          .from(taskBidsTable)
          .where(and(
            eq(taskBidsTable.taskId, task.id),
            eq(taskBidsTable.status, "assigned"),
          ));
        const capacityFilled = afterAssignment.length + otherAssignments.length >= task.maxCompletions ||
          (afterAssignment.length + otherAssignments.length) * task.reward >= task.fundingBudget - 0.000001;
        if (capacityFilled) {
          const remaining = await tx.select({ id: taskBidsTable.id, userId: taskBidsTable.userId })
            .from(taskBidsTable)
            .where(and(
              eq(taskBidsTable.taskId, task.id),
              eq(taskBidsTable.status, "pending"),
            ));
          if (remaining.length) {
            await tx.update(taskBidsTable).set({
              status: "rejected",
              reviewNote: "No funded assignment places remain for this task.",
              reviewedBy: req.userId!,
              reviewedAt: now,
              updatedAt: now,
            }).where(and(
              eq(taskBidsTable.taskId, task.id),
              eq(taskBidsTable.status, "pending"),
            ));
            await tx.insert(notificationsTable).values(remaining.map((pending) => ({
              userId: pending.userId,
              type: "task_bid_declined",
              title: "Task bid update",
              message: `Your bid for "${task.title}" was not selected because all funded places were filled.`,
            })));
          }
        }
      }

      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: status === "assigned" ? "task_bid_assigned" : "task_bid_rejected",
        targetType: "task_bid",
        targetId: bid.id,
        details: { taskId: task.id, userId: bid.userId, note: reviewNote },
      });

      return {
        bid: updatedBid,
        task,
        userName: worker?.name ?? "Worker",
        userEmail: worker?.email ?? "",
        status,
      };
    });

    if ("error" in result) {
      res.status(result.httpStatus ?? 409).json({ error: result.error });
      return;
    }
    res.json(AdminReviewTaskBidResponse.parse({
      id: result.bid.id,
      taskId: result.task.id,
      taskTitle: result.task.title,
      category: result.task.category,
      reward: result.task.reward,
      deadlineHours: result.task.deadlineHours,
      userId: result.bid.userId,
      userName: result.userName,
      userEmail: result.userEmail,
      status: result.status,
      bidAt: result.bid.bidAt.toISOString(),
      deadlineAt: result.bid.deadlineAt?.toISOString() ?? null,
      reviewNote: result.bid.reviewNote,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Could not review task bid");
    res.status(500).json({ error: "Could not save the bid decision." });
  }
});

export default router;
