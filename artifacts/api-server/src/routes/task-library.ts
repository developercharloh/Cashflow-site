import { Router } from "express";
import { adminAuditLogsTable, db, tasksTable } from "@workspace/db";
import {
  AdminGetTasksResponseItem,
  AdminListTaskLibraryQueryParams,
  AdminListTaskLibraryResponse,
  AdminPublishTaskLibraryItemBody,
  AdminPublishTaskLibraryItemParams,
} from "@workspace/api-zod";
import type { TaskFeedCategory } from "../lib/task-feed";
import { getTaskLibraryTemplate, TASK_LIBRARY } from "../data/task-library";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/admin/task-library", requireAdmin, (req: AuthRequest, res) => {
  const query = AdminListTaskLibraryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const category = query.data.category;
  const filtered = TASK_LIBRARY
    .filter((template) => !category || template.category === category)
    .map((template) => ({ ...template, difficulty: "hard" as const, defaultMinLevel: 1 }));
  res.json(AdminListTaskLibraryResponse.parse(filtered));
});

router.post("/admin/task-library/:id/publish", requireAdmin, async (req: AuthRequest, res) => {
  const params = AdminPublishTaskLibraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const input = AdminPublishTaskLibraryItemBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const { reward, fundingBudget, maxCompletions } = input.data;
  const minLevel = input.data.minLevel ?? 1;
  const template = getTaskLibraryTemplate(params.data.id);

  if (!template) {
    res.status(404).json({ error: "Task template not found." });
    return;
  }
  if (
    !Number.isInteger(maxCompletions) || maxCompletions < 1 || maxCompletions > 500 ||
    !Number.isInteger(minLevel) || minLevel < 1 || minLevel > 7 ||
    Math.round(fundingBudget * 100) < Math.round(reward * 100) * maxCompletions
  ) {
    res.status(400).json({ error: "Set a valid reward, completion cap, level, and budget that covers every funded completion." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [task] = await tx.insert(tasksTable).values({
        title: template.title,
        description: template.description,
        instructions: template.instructions,
        assetUrl: template.assetUrl,
        reviewGuide: template.reviewGuide,
        category: template.category as TaskFeedCategory,
        taskType: "written",
        reward: Math.round(reward * 100) / 100,
        fundingBudget: Math.round(fundingBudget * 100) / 100,
        maxCompletions,
        estimatedMinutes: template.estimatedMinutes,
        timeLimitSeconds: template.estimatedMinutes * 60,
        difficulty: "hard",
        minLevel,
        questionCount: 0,
        cooldownHours: 24,
        isActive: true,
        completionCount: 0,
      }).returning();

      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: "task_template_published",
        targetType: "task",
        targetId: task!.id,
        details: {
          templateId: template.id,
          category: template.category,
          reward: task!.reward,
          fundingBudget: task!.fundingBudget,
          maxCompletions: task!.maxCompletions,
          minLevel: task!.minLevel,
        },
      });

      return AdminGetTasksResponseItem.parse(task);
    });

    res.status(201).json(result);
  } catch (error) {
    req.log.error({ err: error }, "Could not publish task library template");
    res.status(500).json({ error: "Could not publish this task template." });
  }
});

export default router;
