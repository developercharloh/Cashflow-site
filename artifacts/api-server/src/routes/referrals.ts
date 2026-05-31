import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/referrals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const host = req.headers.host ?? "taskearnpro.com";
    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const referralLink = `${protocol}://${host}/auth/register?ref=${user.referralCode}`;

    const referred = await db.select().from(usersTable).where(eq(usersTable.referredBy, req.userId!));
    const activeReferrals = referred.filter(u => u.tasksCompleted > 0).length;

    res.json({
      referralCode: user.referralCode,
      referralLink,
      totalReferrals: user.referralCount,
      activeReferrals,
      totalEarned: user.totalReferralEarnings,
      pendingEarnings: user.pendingEarnings,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/referrals/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    const referred = await db.select().from(usersTable).where(eq(usersTable.referredBy, req.userId!));
    res.json(referred.map(u => ({
      id: u.id,
      name: u.name,
      joinedAt: u.createdAt.toISOString(),
      tasksCompleted: u.tasksCompleted,
      status: u.tasksCompleted > 0 ? "active" : "inactive",
      earningsGenerated: u.totalEarned,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
