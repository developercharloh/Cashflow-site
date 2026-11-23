import { Router } from "express";
import { adminAuditLogsTable, db, tasksTable } from "@workspace/db";
import { TASK_FEED_CATEGORIES, type TaskFeedCategory } from "../lib/task-feed";
import { getTaskLibraryTemplate, TASK_LIBRARY } from "../data/task-library";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();
const categorySet = new Set<string>(TASK_FEED_CATEGORIES);

function taskId(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value
    : null;
}

router.get("/admin/task-library", requireAdmin, (req: AuthRequest, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  if (category && !categorySet.has(category)) {
    res.status(400).json({ error: "Unsupported task category." });
    return;
  }

  res.json(
    TASK_LIBRARY.filter((template) => !category || template.category === category)
      .map((template) => ({ ...template, difficulty: "hard", defaultMinLevel: 1 })),
  );
});

router.post("/admin/task-library/:id/publish", requireAdmin, async (req: AuthRequest, res) => {
  const id = taskId(req.params["id"]);
  const template = id ? getTaskLibraryTemplate(id) : undefined;
  const reward = Number(req.body?.reward);
  const fundingBudget = Number(req.body?.fundingBudget);
  const maxCompletions = Number(req.body?.maxCompletions);
  const minLevel = Number(req.body?.minLevel ?? 1);

  if (!template) {
    res.status(404).json({ error: "Task template not found." });
    return;
  }
  if (
    !Number.isFinite(reward) || reward <= 0 || reward > 1_000 ||
    !Number.isFinite(fundingBudget) || fundingBudget <= 0 || fundingBudget > 10_000 ||
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
        questionCount: 5,
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

      return task!;
    });

    res.status(201).json(result);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not publish this task template." });
  }
});

export default router;
