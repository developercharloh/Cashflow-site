import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable, kycSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

// ── Didit v3 config ──────────────────────────────────────────────────────────
const DIDIT_API_KEY    = process.env.DIDIT_API_KEY;
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID ?? "6958dd4e-b834-4e4d-80a7-c64f1e30a6c8";
const DIDIT_BASE_URL   = "https://verification.didit.me";
const CALLBACK_URL     = "https://taskearn-pro.vercel.app/profile?kyc=done";

interface DiditSession {
  session_id: string;
  url: string;
  status: string;
}

async function createDiditSession(vendorData: string): Promise<DiditSession> {
  if (!DIDIT_API_KEY) throw new Error("DIDIT_API_KEY environment variable is not set");
  const res = await fetch(`${DIDIT_BASE_URL}/v3/session/`, {
    method: "POST",
    headers: {
      "x-api-key": DIDIT_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: vendorData,
      callback: CALLBACK_URL,
      callback_method: "both",
    }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.url) {
    const detail = data.detail ?? data.message ?? JSON.stringify(data);
    throw new Error(`Didit session error (${res.status}): ${detail}`);
  }
  return { session_id: data.session_id, url: data.url, status: data.status };
}

// ─── GET /kyc/status ──────────────────────────────────────────────────────────
router.get("/kyc/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      kycStatus: usersTable.kycStatus,
      kycSessionId: usersTable.kycSessionId,
    }).from(usersTable).where(eq(usersTable.id, req.userId!));

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [sub] = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, req.userId!))
      .orderBy(desc(kycSubmissionsTable.submittedAt))
      .limit(1);

    res.json({
      kycStatus: user.kycStatus,
      kycSessionId: user.kycSessionId ?? null,
      submission: sub ? {
        id: sub.id,
        fullName: sub.fullName,
        country: sub.country,
        submittedAt: sub.submittedAt.toISOString(),
        rejectionReason: sub.rejectionReason ?? null,
        faceMatchScore: sub.faceMatchScore ?? null,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/submit — collect personal info + create Didit v3 session ──────
router.post("/kyc/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, dateOfBirth, country, phoneNumber, nationalId } = req.body;
    if (!fullName || !dateOfBirth || !country || !phoneNumber || !nationalId) {
      res.status(400).json({ error: "All fields are required" }); return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }

    // Rate-limit: max 3 submissions per user
    const existing = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, req.userId!));
    if (existing.length >= 3) {
      res.status(429).json({ error: "Maximum KYC submissions reached. Contact support." }); return;
    }

    // Create Didit v3 session
    let session: DiditSession;
    try {
      session = await createDiditSession(String(req.userId));
    } catch (err) {
      req.log.error(err, "Didit session creation error");
      res.status(503).json({ error: (err as Error).message }); return;
    }

    // Save submission record
    await db.insert(kycSubmissionsTable).values({
      userId: req.userId!,
      fullName,
      dateOfBirth,
      country,
      phoneNumber,
      nationalId,
      kycStatus: "pending_review",
      diditSessionId: session.session_id,
    });

    // Update user status
    await db.update(usersTable)
      .set({ kycStatus: "pending", kycSessionId: session.session_id })
      .where(eq(usersTable.id, req.userId!));

    res.json({ url: session.url, sessionId: session.session_id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/upload-documents — manual upload flow (no Didit) ─────────────
router.post("/kyc/upload-documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, dateOfBirth, country, phoneNumber, nationalId, documentType, frontIdImage, backIdImage } = req.body;
    if (!fullName || !dateOfBirth || !country || !phoneNumber || !nationalId || !documentType || !frontIdImage) {
      res.status(400).json({ error: "All fields including front ID image are required" }); return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }

    // Size guard: each base64 image should be ≤ 3 MB (~4MB base64)
    const MAX_B64 = 4 * 1024 * 1024;
    if (frontIdImage.length > MAX_B64 || (backIdImage && backIdImage.length > MAX_B64)) {
      res.status(413).json({ error: "Image too large. Please compress below 3 MB." }); return;
    }

    const existing = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, req.userId!));
    if (existing.length >= 3) {
      res.status(429).json({ error: "Maximum KYC submissions reached. Contact support." }); return;
    }

    await db.insert(kycSubmissionsTable).values({
      userId: req.userId!,
      fullName,
      dateOfBirth,
      country,
      phoneNumber,
      nationalId,
      documentType,
      submissionMethod: "manual_upload",
      frontIdUrl: frontIdImage,
      backIdUrl: backIdImage ?? null,
      kycStatus: "pending_review",
    });

    await db.update(usersTable)
      .set({ kycStatus: "pending" })
      .where(eq(usersTable.id, req.userId!));

    res.json({ ok: true, message: "Documents submitted. Pending admin review." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /kyc/admin/submissions — admin list all KYC submissions ──────────────
router.get("/kyc/admin/submissions", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const subs = await db.select({
      sub: kycSubmissionsTable,
      user: {
        email: usersTable.email,
        name: usersTable.name,
      },
    })
    .from(kycSubmissionsTable)
    .leftJoin(usersTable, eq(kycSubmissionsTable.userId, usersTable.id))
    .orderBy(desc(kycSubmissionsTable.submittedAt));

    res.json(subs.map(({ sub, user }) => ({
      id: sub.id,
      userId: sub.userId,
      userEmail: user?.email ?? "",
      userName: user?.name ?? "",
      fullName: sub.fullName,
      dateOfBirth: sub.dateOfBirth,
      country: sub.country,
      phoneNumber: sub.phoneNumber,
      nationalId: sub.nationalId,
      submissionMethod: sub.submissionMethod,
      documentType: sub.documentType ?? null,
      frontIdUrl: sub.frontIdUrl ?? null,
      backIdUrl: sub.backIdUrl ?? null,
      faceMatchScore: sub.faceMatchScore ?? null,
      kycStatus: sub.kycStatus,
      rejectionReason: sub.rejectionReason ?? null,
      diditSessionId: sub.diditSessionId ?? null,
      submittedAt: sub.submittedAt.toISOString(),
      reviewedAt: sub.reviewedAt?.toISOString() ?? null,
      reviewedBy: sub.reviewedBy ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /kyc/admin/submissions/:id/review — admin approve/reject ─────────────
router.put("/kyc/admin/submissions/:id/review", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const { action, rejectionReason } = req.body;
    if (!["approve", "reject", "resubmit"].includes(action)) {
      res.status(400).json({ error: "action must be approve, reject, or resubmit" }); return;
    }

    const [sub] = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }

    const newSubStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "resubmit_required";
    const newUserStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "none";

    await db.update(kycSubmissionsTable).set({
      kycStatus: newSubStatus,
      rejectionReason: rejectionReason ?? null,
      reviewedAt: new Date(),
      reviewedBy: req.userId,
    }).where(eq(kycSubmissionsTable.id, id));

    await db.update(usersTable).set({
      kycStatus: newUserStatus,
    }).where(eq(usersTable.id, sub.userId));

    res.json({ ok: true, kycStatus: newUserStatus });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/session — create session directly (no pre-form) ───────────────
router.post("/kyc/session", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }
    const session = await createDiditSession(String(req.userId));
    await db.update(usersTable)
      .set({ kycStatus: "pending", kycSessionId: session.session_id })
      .where(eq(usersTable.id, req.userId!));
    res.json({ url: session.url, sessionId: session.session_id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/webhook — Didit calls this on verification completion ──────────
router.post("/kyc/webhook", async (req, res) => {
  try {
    // ── 1. Verify HMAC-SHA256 signature ─────────────────────────────────────
    // Didit sends the signature in the Authorization header as "Bearer <hmac>",
    // where <hmac> is the hex-encoded HMAC-SHA256 of the raw request body using
    // DIDIT_WEBHOOK_SECRET as the key.
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      req.log.error("DIDIT_WEBHOOK_SECRET is not configured — rejecting webhook");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const authHeader = req.headers["authorization"] ?? "";
    const providedSig = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!providedSig) {
      res.status(401).json({ error: "Missing webhook signature" });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Empty request body" });
      return;
    }

    const expectedSig = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    let sigValid: boolean;
    try {
      sigValid = timingSafeEqual(
        Buffer.from(providedSig, "hex"),
        Buffer.from(expectedSig, "hex"),
      );
    } catch {
      sigValid = false;
    }

    if (!sigValid) {
      req.log.warn("KYC webhook signature mismatch");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    const payload = req.body as any;
    const rawStatus: string = (payload.status ?? "").toLowerCase();
    const vendorData: string = payload.vendor_data ?? payload.vendorData ?? "";
    const sessionId: string = payload.session_id ?? payload.sessionId ?? "";
    const faceMatchScore: number | undefined = payload.face_match_score ?? payload.faceMatchScore;

    if (!sessionId) {
      res.status(400).json({ error: "Missing session_id" });
      return;
    }

    const userId = parseInt(vendorData, 10);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ error: "Invalid vendor_data" });
      return;
    }

    // ── 3. Cross-validate session against our own DB ─────────────────────────
    // Two session-creation flows exist:
    //   a) /kyc/submit  → inserts a kycSubmissionsTable row with diditSessionId
    //   b) /kyc/session → only updates usersTable.kycSessionId (no submission row)
    // We accept the session if it appears in either place, then bind userId.

    let resolvedUserId: number | null = null;

    // Check submissions table first (flow a)
    const [existingSub] = await db
      .select({ userId: kycSubmissionsTable.userId })
      .from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.diditSessionId, sessionId))
      .limit(1);

    if (existingSub) {
      resolvedUserId = existingSub.userId;
    } else {
      // Fall back to checking the user record directly (flow b)
      const [userBySession] = await db
        .select({ id: usersTable.id, kycStatus: usersTable.kycStatus })
        .from(usersTable)
        .where(eq(usersTable.kycSessionId, sessionId))
        .limit(1);

      if (userBySession) {
        resolvedUserId = userBySession.id;
      }
    }

    if (resolvedUserId === null) {
      req.log.warn({ sessionId }, "KYC webhook: unknown session_id");
      res.status(400).json({ error: "Unknown session" });
      return;
    }

    if (resolvedUserId !== userId) {
      req.log.warn({ sessionId, claimedUserId: userId, actualUserId: resolvedUserId },
        "KYC webhook: vendor_data userId mismatch");
      res.status(400).json({ error: "Session / user mismatch" });
      return;
    }

    // ── 4. Compute target status ──────────────────────────────────────────────
    const kycStatus =
      rawStatus === "approved" || rawStatus === "completed" ? "approved" :
      rawStatus === "declined" || rawStatus === "rejected" ? "rejected" : "pending";

    // ── 5. Idempotency guard ──────────────────────────────────────────────────
    // If the user's kycStatus already matches the incoming status, there is
    // nothing to do (handles duplicate deliveries gracefully).
    const [currentUser] = await db
      .select({ kycStatus: usersTable.kycStatus })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (currentUser && currentUser.kycStatus === kycStatus) {
      res.json({ ok: true });
      return;
    }

    // ── 6. Apply KYC status update ───────────────────────────────────────────
    await db.update(usersTable)
      .set({ kycStatus, kycSessionId: sessionId })
      .where(eq(usersTable.id, userId));

    await db.update(kycSubmissionsTable).set({
      kycStatus,
      faceMatchScore: faceMatchScore ?? null,
      reviewedAt: new Date(),
    }).where(eq(kycSubmissionsTable.diditSessionId, sessionId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "KYC webhook error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
