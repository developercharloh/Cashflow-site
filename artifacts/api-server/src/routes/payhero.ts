import { Router } from "express";
import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, notificationsTable, transactionsTable, usersTable } from "@workspace/db";
import {
  GetTaskPackageMpesaPurchaseStatusParams,
  GetTaskPackageMpesaPurchaseStatusResponse,
  StartTaskPackageMpesaPurchaseBody,
  StartTaskPackageMpesaPurchaseResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import {
  activateTaskPackageAfterPayment,
  calculateTaskPackageCharge,
  type TaskPackageCode,
} from "../lib/task-package-billing";

const router = Router();
const DEPOSIT_RATE_KES = 130;
const PAYHERO_BASE_URL = "https://backend.payhero.co.ke";
const CALLBACK_URL =
  process.env.PAYHERO_CALLBACK_URL ?? "https://lipwatasks.site/api/payhero/webhook";

type PaymentDetails = {
  externalReference: string;
  providerReference?: string;
  checkoutRequestId?: string;
  packageCode?: TaskPackageCode;
  expectedKes?: number;
};

function parsePaymentDetails(value: string | null): PaymentDetails | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PaymentDetails;
    if (parsed && typeof parsed.externalReference === "string") return parsed;
  } catch {
    // Older pending deposits stored the reference as plain text.
  }
  return { externalReference: value };
}

function getAuthorizationHeader(): string | null {
  const token = process.env.PAYHERO_AUTH_TOKEN?.trim();
  if (!token) return null;
  return /^Basic\s/i.test(token) ? token : `Basic ${token}`;
}

function isSuccessfulStatus(data: any): boolean {
  return data?.success === true && String(data?.status ?? "").toUpperCase() === "SUCCESS";
}

function isFailedStatus(data: any): boolean {
  return ["FAILED", "CANCELLED", "CANCELED"].includes(
    String(data?.status ?? "").toUpperCase(),
  );
}

async function getProviderStatus(reference: string): Promise<any | null> {
  const authorization = getAuthorizationHeader();
  if (!authorization) return null;

  const url = new URL(`${PAYHERO_BASE_URL}/api/v2/transaction-status`);
  url.searchParams.set("reference", reference);
  const response = await fetch(url, {
    headers: { Authorization: authorization },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function findPendingMpesaTransaction(externalReference: string) {
  const pending = await db.select().from(transactionsTable).where(
    and(
      eq(transactionsTable.status, "pending"),
      inArray(transactionsTable.type, ["deposit", "package_purchase"]),
    ),
  );
  return pending.find((transaction) =>
    parsePaymentDetails(transaction.accountDetails)?.externalReference === externalReference,
  );
}

async function settleDeposit(
  transactionId: number,
  userId: number,
  amountUsd: number,
): Promise<number | null> {
  return db.transaction(async (tx) => {
    const claimed = await tx.update(transactionsTable)
      .set({ status: "completed", amount: amountUsd, rejectionReason: null })
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.status, "pending"),
      ))
      .returning({ id: transactionsTable.id });

    if (claimed.length === 0) return null;

    await tx.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${amountUsd}`,
      totalEarned: sql`${usersTable.totalEarned} + ${amountUsd}`,
    }).where(eq(usersTable.id, userId));

    await tx.insert(notificationsTable).values({
      userId,
      type: "deposit",
      title: "Deposit Confirmed",
      message: `$${amountUsd.toFixed(2)} has been credited to your wallet.`,
    });

    return amountUsd;
  });
}

async function reconcileDeposit(transaction: {
  id: number;
  userId: number;
  amount: number;
  accountDetails: string | null;
}): Promise<"completed" | "rejected" | "pending"> {
  const details = parsePaymentDetails(transaction.accountDetails);
  const reference = details?.providerReference ?? details?.checkoutRequestId;
  if (!reference) return "pending";

  const statusData = await getProviderStatus(reference);
  if (!statusData) return "pending";

  if (isSuccessfulStatus(statusData)) {
    await settleDeposit(transaction.id, transaction.userId, transaction.amount);
    return "completed";
  }

  if (isFailedStatus(statusData)) {
    await db.update(transactionsTable).set({
      status: "rejected",
      rejectionReason: "The M-Pesa payment was not completed.",
    }).where(and(
      eq(transactionsTable.id, transaction.id),
      eq(transactionsTable.status, "pending"),
    ));
    return "rejected";
  }

  return "pending";
}

router.post("/wallet/deposits/mpesa", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body?.amount);
    const phone = String(req.body?.phone ?? "");
    const provider = String(req.body?.provider ?? "");
    const authorization = getAuthorizationHeader();
    const channelId = Number(process.env.PAYHERO_CHANNEL_ID);

    if (!Number.isFinite(amount) || amount < 0.1) {
      res.status(400).json({ error: "Minimum deposit is $0.10" });
      return;
    }
    if (provider !== "mpesa") {
      res.status(400).json({ error: "Only M-Pesa Express deposits are currently available." });
      return;
    }
    if (!authorization || !Number.isInteger(channelId) || channelId <= 0) {
      req.log.error("M-Pesa payment configuration is incomplete");
      res.status(503).json({ error: "M-Pesa deposits are temporarily unavailable." });
      return;
    }

    let normalizedPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");
    if (normalizedPhone.startsWith("254")) normalizedPhone = `0${normalizedPhone.slice(3)}`;
    if (!normalizedPhone.startsWith("0")) normalizedPhone = `0${normalizedPhone}`;
    if (!/^0[17]\d{8}$/.test(normalizedPhone)) {
      res.status(400).json({ error: "Enter a valid Kenyan mobile number, such as 0712345678." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const amountKes = Math.round(amount * DEPOSIT_RATE_KES);
    const externalReference = `lp_${req.userId}_${crypto.randomUUID()}`;
    const [pending] = await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "deposit",
      amount,
      status: "pending",
      description: `M-Pesa Express deposit of $${amount.toFixed(2)} (KES ${amountKes})`,
      method: "mpesa",
      accountDetails: JSON.stringify({ externalReference }),
    }).returning();

    const response = await fetch(`${PAYHERO_BASE_URL}/api/v2/payments`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountKes,
        phone_number: normalizedPhone,
        channel_id: channelId,
        provider: "m-pesa",
        external_reference: externalReference,
        customer_name: user.name ?? user.email,
        callback_url: CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const providerData = await response.json() as any;
    if (!response.ok || providerData?.success !== true) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "The M-Pesa payment request could not be started.",
      }).where(and(
        eq(transactionsTable.id, pending.id),
        eq(transactionsTable.status, "pending"),
      ));
      req.log.warn({ status: response.status }, "M-Pesa payment request was rejected");
      res.status(400).json({ error: "Could not start the M-Pesa prompt. Check your number and try again." });
      return;
    }

    await db.update(transactionsTable).set({
      accountDetails: JSON.stringify({
        externalReference,
        providerReference: providerData.reference ?? undefined,
        checkoutRequestId: providerData.CheckoutRequestID ?? undefined,
      } satisfies PaymentDetails),
    }).where(eq(transactionsTable.id, pending.id));

    res.json({
      status: "pending",
      reference: externalReference,
      message: "M-Pesa prompt sent. Enter your PIN to complete the deposit.",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not start the M-Pesa deposit. Please try again." });
  }
});

router.get("/wallet/deposits/:reference/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const reference = String(req.params.reference);
    const deposits = await db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.type, "deposit"),
      ),
    );
    const transaction = deposits.find((deposit) =>
      parsePaymentDetails(deposit.accountDetails)?.externalReference === reference,
    );

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    if (transaction.status === "completed") {
      res.json({ status: "completed", amount: transaction.amount });
      return;
    }
    if (transaction.status === "rejected") {
      res.json({ status: "rejected", reason: transaction.rejectionReason ?? "Payment was not completed." });
      return;
    }

    const status = await reconcileDeposit(transaction);
    if (status === "completed") {
      const [updated] = await db.select().from(transactionsTable)
        .where(eq(transactionsTable.id, transaction.id));
      res.json({ status, amount: updated?.amount ?? transaction.amount });
      return;
    }
    if (status === "rejected") {
      res.json({ status, reason: "Payment was not completed." });
      return;
    }

    res.json({ status: "pending" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not check the deposit status." });
  }
});

router.post("/task-packages/purchase/mpesa", requireAuth, async (req: AuthRequest, res) => {
  const input = StartTaskPackageMpesaPurchaseBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose a package and enter a valid M-Pesa phone number." });
    return;
  }

  const authorization = getAuthorizationHeader();
  const channelId = Number(process.env.PAYHERO_CHANNEL_ID);
  if (!authorization || !Number.isInteger(channelId) || channelId <= 0) {
    req.log.error("M-Pesa package payment configuration is incomplete");
    res.status(503).json({ error: "M-Pesa Express payments are temporarily unavailable." });
    return;
  }

  let normalizedPhone = input.data.phone.replace(/\s+/g, "").replace(/^\+/, "");
  if (normalizedPhone.startsWith("254")) normalizedPhone = `0${normalizedPhone.slice(3)}`;
  if (!normalizedPhone.startsWith("0")) normalizedPhone = `0${normalizedPhone}`;
  if (!/^0[17]\d{8}$/.test(normalizedPhone)) {
    res.status(400).json({ error: "Enter a valid mobile number for M-Pesa Express." });
    return;
  }

  const targetPackage = input.data.package;
  const externalReference = `pkg_${req.userId}_${crypto.randomUUID()}`;

  try {
    const preparation = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .for("update");
      if (!user) return { error: "Account not found.", status: 404 as const };

      const charge = calculateTaskPackageCharge(user.taskPackage, targetPackage);
      if ("error" in charge) return { error: charge.error, status: 409 as const };

      const pendingPayments = await tx.select().from(transactionsTable).where(and(
        eq(transactionsTable.userId, user.id),
        eq(transactionsTable.type, "package_purchase"),
        eq(transactionsTable.method, "mpesa"),
        eq(transactionsTable.status, "pending"),
      ));
      const existingPending = pendingPayments[0];
      if (existingPending) {
        const details = parsePaymentDetails(existingPending.accountDetails);
        if (details?.packageCode && details.expectedKes && details.externalReference) {
          return {
            user,
            transaction: existingPending,
            packageCode: details.packageCode,
            chargeUsd: Math.abs(existingPending.amount),
            amountKes: details.expectedKes,
            alreadyPending: true,
          };
        }
        return {
          error: "Another package payment is already processing. Check its status before retrying.",
          status: 409 as const,
        };
      }

      const [transaction] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "package_purchase",
        amount: -charge.chargeUsd,
        status: "pending",
        description: `${targetPackage === "silver" ? "Silver" : "Diamond"} task package via M-Pesa Express`,
        method: "mpesa",
        accountDetails: JSON.stringify({
          externalReference,
          packageCode: targetPackage,
          expectedKes: charge.amountKes,
        } satisfies PaymentDetails),
      }).returning();

      return {
        user,
        transaction,
        packageCode: targetPackage,
        chargeUsd: charge.chargeUsd,
        amountKes: charge.amountKes,
        alreadyPending: false,
      };
    });

    if ("error" in preparation) {
      res.status(preparation.status ?? 409).json({ error: preparation.error });
      return;
    }

    const details = parsePaymentDetails(preparation.transaction.accountDetails);
    if (!details?.externalReference) {
      res.status(500).json({ error: "Could not prepare the package payment." });
      return;
    }

    if (preparation.alreadyPending) {
      res.json(StartTaskPackageMpesaPurchaseResponse.parse({
        status: "pending",
        reference: details.externalReference,
        package: preparation.packageCode,
        chargeUsd: preparation.chargeUsd,
        amountKes: preparation.amountKes,
        message: "A package payment is already pending. Complete the M-Pesa prompt sent to your phone.",
      }));
      return;
    }

    let response: Response;
    let providerData: any;
    try {
      response = await fetch(`${PAYHERO_BASE_URL}/api/v2/payments`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: preparation.amountKes,
          phone_number: normalizedPhone,
          channel_id: channelId,
          provider: "m-pesa",
          external_reference: details.externalReference,
          customer_name: preparation.user.name ?? preparation.user.email,
          callback_url: CALLBACK_URL,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      providerData = await response.json() as any;
    } catch (error) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "The M-Pesa package payment request could not be started.",
      }).where(and(
        eq(transactionsTable.id, preparation.transaction.id),
        eq(transactionsTable.status, "pending"),
      ));
      throw error;
    }

    if (!response.ok || providerData?.success !== true) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "The M-Pesa package payment request could not be started.",
      }).where(and(
        eq(transactionsTable.id, preparation.transaction.id),
        eq(transactionsTable.status, "pending"),
      ));
      req.log.warn({ status: response.status }, "M-Pesa package payment request was rejected");
      res.status(400).json({ error: "Could not start the M-Pesa prompt. Check your number and try again." });
      return;
    }

    await db.update(transactionsTable).set({
      accountDetails: JSON.stringify({
        ...details,
        providerReference: providerData.reference ?? undefined,
        checkoutRequestId: providerData.CheckoutRequestID ?? undefined,
      } satisfies PaymentDetails),
    }).where(eq(transactionsTable.id, preparation.transaction.id));

    res.json(StartTaskPackageMpesaPurchaseResponse.parse({
      status: "pending",
      reference: details.externalReference,
      package: preparation.packageCode,
      chargeUsd: preparation.chargeUsd,
      amountKes: preparation.amountKes,
      message: "M-Pesa prompt sent. Enter your PIN to complete the package purchase.",
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not start the package payment. Please try again." });
  }
});

router.get("/task-packages/purchase/mpesa/:reference/status", requireAuth, async (req: AuthRequest, res) => {
  const params = GetTaskPackageMpesaPurchaseStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid package payment reference." });
    return;
  }

  try {
    const payments = await db.select().from(transactionsTable).where(and(
      eq(transactionsTable.userId, req.userId!),
      eq(transactionsTable.type, "package_purchase"),
      eq(transactionsTable.method, "mpesa"),
    ));
    const transaction = payments.find((item) =>
      parsePaymentDetails(item.accountDetails)?.externalReference === params.data.reference,
    );
    const details = parsePaymentDetails(transaction?.accountDetails ?? null);
    if (!transaction || !details?.packageCode) {
      res.status(404).json({ error: "Package payment not found." });
      return;
    }

    const packageName = details.packageCode === "silver" ? "Silver" : "Diamond";
    if (transaction.status === "completed") {
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "completed",
        package: details.packageCode,
        message: `${packageName} task access is active.`,
      }));
      return;
    }
    if (transaction.status === "rejected") {
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "rejected",
        package: details.packageCode,
        message: transaction.rejectionReason ?? "The payment was not completed.",
      }));
      return;
    }

    const providerReference = details.providerReference ?? details.checkoutRequestId;
    if (!providerReference) {
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "pending",
        package: details.packageCode,
        message: "The payment is still processing. Check your phone for the M-Pesa prompt.",
      }));
      return;
    }

    const statusData = await getProviderStatus(providerReference);
    if (!statusData) {
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "pending",
        package: details.packageCode,
        message: "The payment is still processing.",
      }));
      return;
    }

    if (isFailedStatus(statusData)) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "The M-Pesa payment was not completed.",
      }).where(and(
        eq(transactionsTable.id, transaction.id),
        eq(transactionsTable.status, "pending"),
      ));
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "rejected",
        package: details.packageCode,
        message: "The payment was not completed. You can try again.",
      }));
      return;
    }

    if (isSuccessfulStatus(statusData)) {
      const returnedReference = statusData.reference ?? statusData.provider_reference;
      const expectedReference = details.providerReference ?? details.checkoutRequestId;
      if (returnedReference && expectedReference && returnedReference !== expectedReference) {
        res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
          status: "pending",
          package: details.packageCode,
          message: "The payment is still processing.",
        }));
        return;
      }

      await activateTaskPackageAfterPayment(transaction.id, transaction.userId, details.packageCode);
      res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
        status: "completed",
        package: details.packageCode,
        message: `${packageName} task access is active.`,
      }));
      return;
    }

    res.json(GetTaskPackageMpesaPurchaseStatusResponse.parse({
      status: "pending",
      package: details.packageCode,
      message: "The payment is still processing.",
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not check the package payment status." });
  }
});

router.post("/wallet/deposits/verify-pending", requireAuth, async (req: AuthRequest, res) => {
  try {
    const pending = await db.select().from(transactionsTable).where(
      and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "pending"),
      ),
    );
    const credited: { ref: string; amount: number }[] = [];

    for (const transaction of pending) {
      try {
        const details = parsePaymentDetails(transaction.accountDetails);
        if (!details?.externalReference) continue;
        const status = await reconcileDeposit(transaction);
        if (status === "completed") {
          credited.push({ ref: details.externalReference, amount: transaction.amount });
        }
      } catch {
        // Continue reconciling other pending deposits if one request fails.
      }
    }

    res.json({ credited, count: credited.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Could not reconcile pending deposits." });
  }
});

router.post("/payhero/webhook", async (req, res) => {
  try {
    const callback = req.body?.response;
    const externalReference = String(callback?.ExternalReference ?? "");
    if (!externalReference) {
      res.status(400).json({ error: "Missing payment reference" });
      return;
    }

    const transaction = await findPendingMpesaTransaction(externalReference);
    if (!transaction) {
      res.sendStatus(200);
      return;
    }

    const details = parsePaymentDetails(transaction.accountDetails);
    const providerReference =
      details?.providerReference ?? details?.checkoutRequestId ?? callback?.CheckoutRequestID;
    const callbackAmount = Number(callback?.Amount);
    const expectedKes = transaction.type === "package_purchase"
      ? details?.expectedKes
      : Math.round(transaction.amount * DEPOSIT_RATE_KES);
    if (!Number.isFinite(expectedKes)) {
      req.log.error({ transactionId: transaction.id }, "M-Pesa payment is missing its expected amount");
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }
    if (!providerReference) {
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }

    const statusData = await getProviderStatus(providerReference);
    if (!statusData) {
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }
    if (isFailedStatus(statusData)) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "The M-Pesa payment was not completed.",
      }).where(and(
        eq(transactionsTable.id, transaction.id),
        eq(transactionsTable.status, "pending"),
      ));
      res.sendStatus(200);
      return;
    }
    if (!isSuccessfulStatus(statusData)) {
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }

    const returnedReference = statusData.reference ?? statusData.provider_reference;
    const expectedReference = details?.providerReference ?? details?.checkoutRequestId;
    if (expectedReference && returnedReference && returnedReference !== expectedReference) {
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }

    const callbackIsValid =
      req.body?.status === true &&
      Number(callback?.ResultCode) === 0 &&
      String(callback?.Status ?? "").toLowerCase() === "success" &&
      Number.isFinite(callbackAmount);
    if (!callbackIsValid) {
      res.status(503).json({ error: "Payment confirmation is still pending." });
      return;
    }
    if (callbackAmount !== expectedKes) {
      await db.update(transactionsTable).set({
        status: "rejected",
        rejectionReason: "Payment amount did not match the requested amount. Contact support.",
      }).where(and(
        eq(transactionsTable.id, transaction.id),
        eq(transactionsTable.status, "pending"),
      ));
      res.sendStatus(200);
      return;
    }

    if (transaction.type === "package_purchase") {
      if (!details?.packageCode || !["silver", "diamond"].includes(details.packageCode)) {
        req.log.error({ transactionId: transaction.id }, "M-Pesa package payment is missing its package");
        res.status(503).json({ error: "Package payment details are incomplete." });
        return;
      }
      await activateTaskPackageAfterPayment(transaction.id, transaction.userId, details.packageCode);
    } else {
      await settleDeposit(transaction.id, transaction.userId, transaction.amount);
    }
    res.sendStatus(200);
  } catch (err) {
    req.log.error(err);
    res.status(503).json({ error: "Payment confirmation is still pending." });
  }
});

export default router;
