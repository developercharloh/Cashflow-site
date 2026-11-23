import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  adminAuditLogsTable,
  db,
  taskFeedImportsTable,
  taskFeedSourcesTable,
  tasksTable,
} from "@workspace/db";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth";
import { TASK_FEED_CATEGORIES, readTaskFeed } from "../lib/task-feed";

const router = Router();
const categorySet = new Set<string>(TASK_FEED_CATEGORIES);

function validHttpsUrl(value: unknown, allowPathQuery = false): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      (allowPathQuery || (!url.search && !url.hash));
  } catch {
    return false;
  }
}

function validId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cleanError(error: unknown): string {
  if (!(error instanceof Error)) return "The feed could not be read.";
  return error.message.slice(0, 240);
}

router.get("/admin/task-sources", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sources = await db.select().from(taskFeedSourcesTable).orderBy(desc(taskFeedSourcesTable.createdAt));
    res.json(sources);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not load task sources." });
  }
});

router.post("/admin/task-sources", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const licenseName = typeof body.licenseName === "string" ? body.licenseName.trim() : "";
    const allowedCategories = Array.isArray(body.allowedCategories) ? body.allowedCategories : [];
    if (name.length < 2 || name.length > 100) {
      res.status(400).json({ error: "Source name must be 2 to 100 characters." });
      return;
    }
    if (!validHttpsUrl(body.feedUrl)) {
      res.status(400).json({ error: "Use a public HTTPS feed URL without credentials, query parameters, or fragments." });
      return;
    }
    if (licenseName.length < 3 || licenseName.length > 120 || !validHttpsUrl(body.licenseUrl, true)) {
      res.status(400).json({ error: "Provide the license name and its public HTTPS terms URL." });
      return;
    }
    if (
      !Array.isArray(allowedCategories) ||
      allowedCategories.length === 0 ||
      allowedCategories.length > TASK_FEED_CATEGORIES.length ||
      allowedCategories.some((category: unknown) => typeof category !== "string" || !categorySet.has(category)) ||
      new Set(allowedCategories).size !== allowedCategories.length
    ) {
      res.status(400).json({ error: "Select one or more supported task categories." });
      return;
    }
    if (body.reuseRightsConfirmed !== true) {
      res.status(400).json({ error: "Confirm that the source license permits this paid reuse before connecting it." });
      return;
    }

    const [source] = await db.insert(taskFeedSourcesTable).values({
      name,
      feedUrl: body.feedUrl,
      licenseName,
      licenseUrl: body.licenseUrl,
      allowedCategories,
      reuseRightsConfirmedAt: new Date(),
      isActive: true,
      createdBy: req.userId!,
    }).returning();

    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_feed_source_added",
      targetType: "task_feed_source",
      targetId: source!.id,
      details: { name, allowedCategories, licenseName },
    });
    res.status(201).json(source);
  } catch (error) {
    req.log.error(error);
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This feed URL is already connected." });
      return;
    }
    res.status(500).json({ error: "Could not add the task source." });
  }
});

router.patch("/admin/task-sources/:id", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = validId(req.params["id"]);
    if (!id || typeof req.body?.isActive !== "boolean") {
      res.status(400).json({ error: "Provide a valid source and active status." });
      return;
    }
    const [source] = await db.update(taskFeedSourcesTable)
      .set({ isActive: req.body.isActive })
      .where(eq(taskFeedSourcesTable.id, id))
      .returning();
    if (!source) {
      res.status(404).json({ error: "Task source not found." });
      return;
    }
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: source.isActive ? "task_feed_source_enabled" : "task_feed_source_disabled",
      targetType: "task_feed_source",
      targetId: source.id,
      details: { name: source.name },
    });
    res.json(source);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not update the task source." });
  }
});

router.post("/admin/task-sources/:id/sync", requireAdmin, async (req: AuthRequest, res) => {
  const id = validId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid source." });
    return;
  }

  let source: typeof taskFeedSourcesTable.$inferSelect | undefined;
  try {
    [source] = await db.select().from(taskFeedSourcesTable).where(eq(taskFeedSourcesTable.id, id));
    if (!source) {
      res.status(404).json({ error: "Task source not found." });
      return;
    }
    if (!source.isActive || !source.reuseRightsConfirmedAt) {
      res.status(409).json({ error: "Enable the source and confirm its reuse rights before syncing." });
      return;
    }

    const feed = await readTaskFeed(source.feedUrl, source.allowedCategories);
    let inserted: Array<{ id: number }> = [];
    if (feed.tasks.length) {
      inserted = await db.insert(taskFeedImportsTable).values(feed.tasks.map((task) => ({
        sourceId: source!.id,
        externalId: task.externalId,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        category: task.category,
        estimatedMinutes: task.estimatedMinutes,
        sourceUrl: task.sourceUrl,
        sourceNameSnapshot: source!.name,
        licenseNameSnapshot: source!.licenseName,
        licenseUrlSnapshot: source!.licenseUrl,
        status: "pending",
      }))).onConflictDoNothing().returning({ id: taskFeedImportsTable.id });
    }

    const duplicates = feed.tasks.length - inserted.length;
    const hasSkipped = feed.skippedUnsupported > 0 || feed.skippedInvalid > 0;
    const summary = [
      `${inserted.length} new`,
      `${duplicates} already imported`,
      `${feed.skippedUnsupported} outside approved categories`,
      `${feed.skippedInvalid} invalid`,
    ].join("; ");
    const [updatedSource] = await db.update(taskFeedSourcesTable).set({
      lastSyncedAt: new Date(),
      lastSyncStatus: hasSkipped ? "warning" : "success",
      lastSyncMessage: summary,
    }).where(eq(taskFeedSourcesTable.id, source.id)).returning();

    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_feed_synced",
      targetType: "task_feed_source",
      targetId: source.id,
      details: { imported: inserted.length, duplicates, skippedUnsupported: feed.skippedUnsupported, skippedInvalid: feed.skippedInvalid },
    });
    res.json({
      source: updatedSource,
      imported: inserted.length,
      duplicates,
      skippedUnsupported: feed.skippedUnsupported,
      skippedInvalid: feed.skippedInvalid,
    });
  } catch (error) {
    req.log.error(error);
    const message = cleanError(error);
    if (source) {
      await db.update(taskFeedSourcesTable).set({
        lastSyncedAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncMessage: message,
      }).where(eq(taskFeedSourcesTable.id, source.id)).catch((updateError) => req.log.error(updateError));
    }
    res.status(400).json({ error: message });
  }
});

router.get("/admin/task-imports", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    if (requestedStatus && !["pending", "published", "skipped"].includes(requestedStatus)) {
      res.status(400).json({ error: "Invalid import status." });
      return;
    }
    const rows = await db.select({
      item: taskFeedImportsTable,
      sourceActive: taskFeedSourcesTable.isActive,
    }).from(taskFeedImportsTable)
      .innerJoin(taskFeedSourcesTable, eq(taskFeedImportsTable.sourceId, taskFeedSourcesTable.id))
      .where(requestedStatus ? eq(taskFeedImportsTable.status, requestedStatus) : undefined)
      .orderBy(desc(taskFeedImportsTable.createdAt))
      .limit(200);
    res.json(rows.map(({ item, sourceActive }) => ({ ...item, sourceActive })));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not load imported tasks." });
  }
});

router.post("/admin/task-imports/:id/publish", requireAdmin, async (req: AuthRequest, res) => {
  const id = validId(req.params["id"]);
  const body = req.body ?? {};
  const reward = Number(body.reward);
  const fundingBudget = Number(body.fundingBudget);
  const maxCompletions = Number(body.maxCompletions);
  const minLevel = Number(body.minLevel);

  if (
    !id ||
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
      const [item] = await tx.select().from(taskFeedImportsTable)
        .where(eq(taskFeedImportsTable.id, id))
        .for("update");
      if (!item) return { error: "Imported task not found.", status: 404 as const };
      if (item.status !== "pending") return { error: "This imported task has already been reviewed.", status: 409 as const };
      if (!categorySet.has(item.category)) return { error: "This task category is not approved.", status: 400 as const };

      const [source] = await tx.select().from(taskFeedSourcesTable)
        .where(eq(taskFeedSourcesTable.id, item.sourceId))
        .for("update");
      if (!source?.isActive || !source.reuseRightsConfirmedAt) {
        return { error: "The source is disabled or its reuse rights are not confirmed.", status: 409 as const };
      }
      const [task] = await tx.insert(tasksTable).values({
        title: item.title,
        description: item.description,
        instructions: item.instructions,
        category: item.category,
        taskType: "written",
        reward: Math.round(reward * 100) / 100,
        fundingBudget: Math.round(fundingBudget * 100) / 100,
        maxCompletions,
        estimatedMinutes: item.estimatedMinutes,
        timeLimitSeconds: item.estimatedMinutes * 60,
        difficulty: "hard",
        minLevel,
        questionCount: 5,
        cooldownHours: 24,
        isActive: true,
        completionCount: 0,
      }).returning();
      const [updatedImport] = await tx.update(taskFeedImportsTable).set({
        status: "published",
        publishedTaskId: task!.id,
      }).where(and(
        eq(taskFeedImportsTable.id, item.id),
        eq(taskFeedImportsTable.status, "pending"),
      )).returning();
      if (!updatedImport) throw new Error("Imported task changed while it was being published.");

      await tx.insert(adminAuditLogsTable).values({
        adminUserId: req.userId!,
        action: "licensed_task_published",
        targetType: "task",
        targetId: task!.id,
        details: {
          importId: item.id,
          sourceId: source.id,
          sourceName: item.sourceNameSnapshot,
          sourceUrl: item.sourceUrl,
          licenseName: item.licenseNameSnapshot,
          licenseUrl: item.licenseUrlSnapshot,
          reward: task!.reward,
          fundingBudget: task!.fundingBudget,
          maxCompletions: task!.maxCompletions,
        },
      });
      return { task, import: updatedImport };
    });

    if ("error" in result) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      ...result,
      import: { ...result.import, sourceActive: true },
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not publish this imported task." });
  }
});

router.post("/admin/task-imports/:id/skip", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = validId(req.params["id"]);
    if (!id) {
      res.status(400).json({ error: "Invalid imported task." });
      return;
    }
    const [item] = await db.update(taskFeedImportsTable).set({ status: "skipped" })
      .where(and(eq(taskFeedImportsTable.id, id), eq(taskFeedImportsTable.status, "pending")))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Pending imported task not found." });
      return;
    }
    const [source] = await db.select({ isActive: taskFeedSourcesTable.isActive })
      .from(taskFeedSourcesTable)
      .where(eq(taskFeedSourcesTable.id, item.sourceId));
    await db.insert(adminAuditLogsTable).values({
      adminUserId: req.userId!,
      action: "task_import_skipped",
      targetType: "task_import",
      targetId: item.id,
      details: { title: item.title, sourceId: item.sourceId },
    });
    res.json({ ...item, sourceActive: source?.isActive ?? false });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not skip this imported task." });
  }
});

export default router;
