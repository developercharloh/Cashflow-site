import { Router } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  AdminCreateSupportMessageBody,
  AdminCreateSupportMessageParams,
  AdminGetSupportThreadParams,
  AdminGetSupportThreadResponse,
  AdminListSupportThreadsQueryParams,
  AdminListSupportThreadsResponse,
  AdminResolveSupportThreadParams,
  CreateSupportMessageBody,
  GetSupportThreadResponse,
} from "@workspace/api-zod";
import {
  db,
  supportMessagesTable,
  supportThreadsTable,
  usersTable,
} from "@workspace/db";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

function serializeMessage(message: typeof supportMessagesTable.$inferSelect) {
  return {
    id: message.id,
    threadId: message.threadId,
    authorType: message.authorType,
    body: message.body,
    createdAt: message.createdAt,
  };
}

async function getWorkerThread(userId: number) {
  const [thread] = await db
    .select()
    .from(supportThreadsTable)
    .where(eq(supportThreadsTable.userId, userId))
    .limit(1);

  if (!thread) {
    return GetSupportThreadResponse.parse({ thread: null, messages: [] });
  }

  const messages = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.threadId, thread.id))
    .orderBy(supportMessagesTable.createdAt, supportMessagesTable.id);

  return GetSupportThreadResponse.parse({
    thread,
    messages: messages.map(serializeMessage),
  });
}

async function getAdminThread(threadId: number) {
  const [row] = await db
    .select({
      thread: supportThreadsTable,
      workerId: usersTable.id,
      workerName: usersTable.name,
      workerEmail: usersTable.email,
    })
    .from(supportThreadsTable)
    .innerJoin(usersTable, eq(supportThreadsTable.userId, usersTable.id))
    .where(eq(supportThreadsTable.id, threadId))
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.threadId, threadId))
    .orderBy(supportMessagesTable.createdAt, supportMessagesTable.id);
  const lastMessage = messages.at(-1);

  return AdminGetSupportThreadResponse.parse({
    thread: {
      id: row.thread.id,
      workerId: row.workerId,
      workerName: row.workerName,
      workerEmail: row.workerEmail,
      status: row.thread.status,
      latestMessage: lastMessage?.body ?? "",
      createdAt: row.thread.createdAt,
      updatedAt: row.thread.updatedAt,
    },
    messages: messages.map(serializeMessage),
  });
}

async function insertMessage(
  threadId: number,
  authorType: "worker" | "admin",
  authorUserId: number,
  body: string,
  status: "open" | "replied",
) {
  await db.transaction(async (tx) => {
    await tx.insert(supportMessagesTable).values({
      threadId,
      authorType,
      authorUserId,
      body,
    });
    await tx
      .update(supportThreadsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportThreadsTable.id, threadId));
  });
}

router.get("/support/thread", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const response = await getWorkerThread(req.userId!);
  res.json(response);
});

router.post("/support/thread/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSupportMessageBody.safeParse(req.body);
  const body = parsed.success ? parsed.data.body.trim() : "";
  if (!parsed.success || !body) {
    res.status(400).json({ error: parsed.success ? "Message cannot be empty." : parsed.error.message });
    return;
  }

  const userId = req.userId!;
  let [thread] = await db
    .select()
    .from(supportThreadsTable)
    .where(eq(supportThreadsTable.userId, userId))
    .limit(1);

  if (!thread) {
    [thread] = await db
      .insert(supportThreadsTable)
      .values({ userId, status: "open" })
      .onConflictDoNothing({ target: supportThreadsTable.userId })
      .returning();
    if (!thread) {
      [thread] = await db
        .select()
        .from(supportThreadsTable)
        .where(eq(supportThreadsTable.userId, userId))
        .limit(1);
    }
  }

  if (!thread) {
    res.status(500).json({ error: "Unable to open a support thread." });
    return;
  }

  await insertMessage(thread.id, "worker", userId, body, "open");
  res.status(201).json(await getWorkerThread(userId));
});

router.get("/admin/support/threads", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AdminListSupportThreadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = parsed.data.status === "all"
    ? undefined
    : eq(supportThreadsTable.status, parsed.data.status);
  const rows = await db
    .select({
      thread: supportThreadsTable,
      workerId: usersTable.id,
      workerName: usersTable.name,
      workerEmail: usersTable.email,
    })
    .from(supportThreadsTable)
    .innerJoin(usersTable, eq(supportThreadsTable.userId, usersTable.id))
    .where(conditions)
    .orderBy(desc(supportThreadsTable.updatedAt))
    .limit(200);

  const threadIds = rows.map(({ thread }) => thread.id);
  const messages = threadIds.length
    ? await db
        .select()
        .from(supportMessagesTable)
        .where(inArray(supportMessagesTable.threadId, threadIds))
        .orderBy(desc(supportMessagesTable.createdAt), desc(supportMessagesTable.id))
    : [];
  const latestByThread = new Map<number, string>();
  for (const message of messages) {
    if (!latestByThread.has(message.threadId)) {
      latestByThread.set(message.threadId, message.body);
    }
  }

  res.json(AdminListSupportThreadsResponse.parse(rows.map(({ thread, workerId, workerName, workerEmail }) => ({
    id: thread.id,
    workerId,
    workerName,
    workerEmail,
    status: thread.status,
    latestMessage: latestByThread.get(thread.id) ?? "",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }))));
});

router.get("/admin/support/threads/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = AdminGetSupportThreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const response = await getAdminThread(params.data.id);
  if (!response) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  res.json(response);
});

router.post("/admin/support/threads/:id/resolve", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = AdminResolveSupportThreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [thread] = await db
    .update(supportThreadsTable)
    .set({ status: "resolved", updatedAt: new Date() })
    .where(eq(supportThreadsTable.id, params.data.id))
    .returning({ id: supportThreadsTable.id });

  if (!thread) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }

  const response = await getAdminThread(thread.id);
  if (!response) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  res.json(response);
});

router.post("/admin/support/threads/:id/messages", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = AdminCreateSupportMessageParams.safeParse(req.params);
  const parsed = AdminCreateSupportMessageBody.safeParse(req.body);
  const body = parsed.success ? parsed.data.body.trim() : "";
  if (!params.success || !parsed.success || !body) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : parsed.success
          ? "Message cannot be empty."
          : parsed.error.message,
    });
    return;
  }

  const [thread] = await db
    .select({ id: supportThreadsTable.id })
    .from(supportThreadsTable)
    .where(eq(supportThreadsTable.id, params.data.id))
    .limit(1);
  if (!thread) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }

  await insertMessage(thread.id, "admin", req.userId!, body, "replied");
  const response = await getAdminThread(thread.id);
  if (!response) {
    res.status(404).json({ error: "Support thread not found." });
    return;
  }
  res.status(201).json(response);
});

export default router;
