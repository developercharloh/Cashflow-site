import { Router } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

type Direction = "rise" | "fall" | "even" | "odd" | "matches" | "differs" | "over" | "under";

const STATIC_PAYOUTS: Partial<Record<Direction, number>> = {
  rise: 1.85, fall: 1.85, even: 1.90, odd: 1.90, matches: 9.00, differs: 1.10,
};

/** Over [n]: 9-n winning digits. Under [n]: n winning digits. 5% house edge. */
function overUnderPayout(dir: "over" | "under", barrier: number): number {
  const winCount = dir === "over" ? 9 - barrier : barrier;
  if (winCount <= 0) return 9.50;
  return Math.round(0.95 / (winCount / 10) * 100) / 100;
}

function generateWin(direction: Direction, lastDigit: number, barrier: number): boolean {
  switch (direction) {
    case "rise":    return Math.random() < 0.47;
    case "fall":    return Math.random() < 0.47;
    case "even":    return lastDigit % 2 === 0;
    case "odd":     return lastDigit % 2 !== 0;
    case "matches": return lastDigit === barrier;
    case "differs": return lastDigit !== barrier;
    case "over":    return lastDigit > barrier;
    case "under":   return lastDigit < barrier;
  }
}

router.post("/binary/trade", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { stake, direction, barrier = 5, isDemo } = req.body;
    if (!stake || stake <= 0 || !direction) {
      res.status(400).json({ error: "Invalid trade parameters" }); return;
    }

    const dir = direction as Direction;
    const barrierN = parseInt(String(barrier));
    const lastDigit = Math.floor(Math.random() * 10);
    const win = generateWin(dir, lastDigit, barrierN);
    const multiplier = (dir === "over" || dir === "under")
      ? overUnderPayout(dir, barrierN)
      : (STATIC_PAYOUTS[dir] ?? 1.85);
    const payout = win ? Math.round(stake * multiplier * 100) / 100 : 0;
    const netChange = Math.round((payout - stake) * 100) / 100;

    if (isDemo) {
      res.json({ win, payout, netChange, lastDigit }); return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.balance < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

    const newBalance = Math.max(0, Math.round((user.balance + netChange) * 100) / 100);
    await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, req.userId!));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: win ? "earning" : "withdrawal",
      amount: win ? payout : stake,
      status: "completed",
      description: `Binary ${dir.toUpperCase()} ${win ? "WIN" : "LOSS"} — stake $${stake.toFixed(2)}`,
    });

    res.json({ win, payout, netChange, lastDigit, newBalance });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
