import { and, eq } from "drizzle-orm";
import { db, notificationsTable, transactionsTable, usersTable } from "@workspace/db";

export type TaskPackageCode = "silver" | "diamond";

const PACKAGE_PRICE_CENTS: Record<TaskPackageCode, number> = {
  silver: 769,
  diamond: 1923,
};

const PACKAGE_ACCESS_CENTS: Record<string, number> = {
  free: 0,
  silver: PACKAGE_PRICE_CENTS.silver,
  legacy: PACKAGE_PRICE_CENTS.silver,
  diamond: PACKAGE_PRICE_CENTS.diamond,
};

export function calculateTaskPackageCharge(
  currentPackage: string,
  targetPackage: TaskPackageCode,
) {
  const ownedCents = PACKAGE_ACCESS_CENTS[currentPackage] ?? 0;
  const targetCents = PACKAGE_PRICE_CENTS[targetPackage];

  if (ownedCents >= targetCents) {
    return {
      error: currentPackage === targetPackage
        ? "You already own this package."
        : "Your current package already includes unlimited task access.",
    } as const;
  }

  const chargeCents = targetCents - ownedCents;
  return {
    chargeUsd: chargeCents / 100,
    amountKes: Math.round(chargeCents * 130 / 100),
  } as const;
}

function accessRank(packageCode: string) {
  return packageCode === "diamond" ? 2 : ["silver", "legacy"].includes(packageCode) ? 1 : 0;
}

export async function activateTaskPackageAfterPayment(
  transactionId: number,
  userId: number,
  targetPackage: TaskPackageCode,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) throw new Error("Package payment user no longer exists.");

    const [claimedPayment] = await tx.update(transactionsTable)
      .set({ status: "completed", rejectionReason: null })
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "package_purchase"),
        eq(transactionsTable.status, "pending"),
      ))
      .returning({ id: transactionsTable.id });
    if (!claimedPayment) return false;

    if (accessRank(user.taskPackage) < accessRank(targetPackage)) {
      const now = new Date();
      await tx.update(usersTable).set({
        taskPackage: targetPackage,
        taskPackagePurchasedAt: now,
        updatedAt: now,
      }).where(eq(usersTable.id, userId));

      const packageName = targetPackage === "silver" ? "Silver" : "Diamond";
      await tx.insert(notificationsTable).values({
        userId,
        type: "package_purchased",
        title: `${packageName} package active`,
        message: `Your ${packageName} package is active. You can now bid on unlimited tasks.`,
      });
    }

    return true;
  });
}
