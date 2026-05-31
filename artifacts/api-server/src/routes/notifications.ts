import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifs = await db.select().from(notificationsTable)
      .where(or(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isGlobal, true)))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifs.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [notif] = await db.update(notificationsTable).set({ isRead: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    res.json({ ...notif, createdAt: notif.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
