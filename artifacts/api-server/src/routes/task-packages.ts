import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, notificationsTable, transactionsTable, usersTable } from "@workspace/db";
import {
  GetTaskPackageInfoResponse,
  PurchaseTaskPackageBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

const PACKAGES = [
  {
    code: "silver" as const,
    name: "Silver",
    price: 7.69,
    description: "One-time purchase for unlimited task bids.",
  },
  {
    code: "diamond" as const,
    name: "Diamond",
    price: 19.23,
    description: "One-time purchase for unlimited task bids.",
  },
];

function packageInfo(user: typeof usersTable.$inferSelect) {
  return GetTaskPackageInfoResponse.parse({
    currentPackage: user.taskPackage,
    purchasedAt: user.taskPackagePurchasedAt?.toISOString() ?? null,
    walletBalance: Math.round(user.balance * 100) / 100,
    packages: PACKAGES,
  });
}

router.get("/task-packages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json(packageInfo(user));
  } catch (error) {
    req.log.error({ err: error }, "Could not load task package information");
    res.status(500).json({ error: "Could not load packages right now." });
  }
});

router.post("/task-packages/purchase", requireAuth, async (req: AuthRequest, res) => {
  const input = PurchaseTaskPackageBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose either the Silver or Diamond package." });
    return;
  }

  const targetPackage = PACKAGES.find((item) => item.code === input.data.package)!;
  const targetPriceCents = Math.round(targetPackage.price * 100);

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .for("update");
      if (!user) return { error: "Account not found.", status: 404 as const };

      const ownedValue = user.taskPackage === "diamond"
        ? 1923
        : user.taskPackage === "silver" || user.taskPackage === "legacy"
          ? 769
          : 0;
      if (ownedValue >= targetPriceCents) {
        return {
          error: user.taskPackage === targetPackage.code
            ? "You already own this package."
            : "Your current package already includes unlimited task access.",
          status: 409 as const,
        };
      }

      const chargeCents = targetPriceCents - ownedValue;
      const balanceCents = Math.floor((user.balance + 0.000001) * 100);
      if (balanceCents < chargeCents) {
        return { error: "Your wallet balance is not enough for this package.", status: 409 as const };
      }

      const now = new Date();
      const nextBalance = (balanceCents - chargeCents) / 100;
      const [updatedUser] = await tx.update(usersTable).set({
        balance: nextBalance,
        taskPackage: targetPackage.code,
        taskPackagePurchasedAt: now,
        updatedAt: now,
      }).where(eq(usersTable.id, user.id)).returning();

      const amount = chargeCents / 100;
      await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "package_purchase",
        amount: -amount,
        description: `${targetPackage.name} task package${ownedValue > 0 ? " upgrade" : ""}`,
        status: "completed",
      });
      await tx.insert(notificationsTable).values({
        userId: user.id,
        type: "package_purchased",
        title: `${targetPackage.name} package active`,
        message: `Your ${targetPackage.name} package is active. You can now bid on unlimited tasks.`,
      });

      return { user: updatedUser };
    });

    if ("error" in result) {
      res.status(result.status ?? 409).json({ error: result.error });
      return;
    }
    res.json(packageInfo(result.user));
  } catch (error) {
    req.log.error({ err: error }, "Could not purchase task package");
    res.status(500).json({ error: "Package purchase could not be completed. Your wallet was not charged." });
  }
});

export default router;
