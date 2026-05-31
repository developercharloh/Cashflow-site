import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/leaderboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type = "earners" } = req.query as { type?: string };

    let users = await db.select().from(usersTable).where(eq(usersTable.isBanned, false)).limit(50);

    let sorted: typeof users;
    if (type === "referrers") {
      sorted = users.sort((a, b) => b.referralCount - a.referralCount);
    } else if (type === "completers") {
      sorted = users.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    } else {
      sorted = users.sort((a, b) => b.totalEarned - a.totalEarned);
    }

    const top = sorted.slice(0, 20);
    const badges: Record<number, string> = { 0: "gold", 1: "silver", 2: "bronze" };

    res.json(top.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatar: u.avatar,
      value: type === "referrers" ? u.referralCount : type === "completers" ? u.tasksCompleted : u.totalEarned,
      badge: badges[i] ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/membership/levels", requireAuth, async (_req, res) => {
  res.json([
    { level: 1, name: "Explorer", description: "Start your earning journey", minEarnings: 0, maxEarnings: 50, taskMultiplier: 1.0, perks: ["Access to basic tasks", "Daily check-in bonus", "Referral program"] },
    { level: 2, name: "Builder", description: "Build your earning momentum", minEarnings: 50, maxEarnings: 200, taskMultiplier: 1.2, perks: ["All Explorer perks", "Better-paying tasks", "20% reward bonus", "Priority support"] },
    { level: 3, name: "Professional", description: "Unlock premium opportunities", minEarnings: 200, maxEarnings: 500, taskMultiplier: 1.5, perks: ["All Builder perks", "Premium task access", "50% reward bonus", "Exclusive surveys", "Dedicated support"] },
    { level: 4, name: "Elite", description: "The highest earning tier", minEarnings: 500, maxEarnings: null, taskMultiplier: 2.0, perks: ["All Professional perks", "Highest-paying tasks", "2x reward multiplier", "Priority withdrawals", "Elite badge", "VIP support"] },
  ]);
});

export default router;
