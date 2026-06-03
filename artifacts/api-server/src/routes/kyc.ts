import { Router } from "express";
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
    // ── 1. Extract session_id from payload ───────────────────────────────────
    const payload = req.body as any;
    const sessionId: string = payload.session_id ?? payload.sessionId ?? "";

    if (!sessionId) {
      res.status(400).json({ error: "Missing session_id" });
      return;
    }

    // ── 2. Verify by calling Didit API — never trust payload status blindly ──
    // We fetch the session directly from Didit using our API key.
    // If the session doesn't exist on Didit's side, we reject.
    if (!DIDIT_API_KEY) {
      req.log.error("DIDIT_API_KEY not configured");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    const diditRes = await fetch(`${DIDIT_BASE_URL}/v3/session/${sessionId}/decision/`, {
      headers: { "x-api-key": DIDIT_API_KEY },
    });

    if (!diditRes.ok) {
      req.log.warn({ sessionId, status: diditRes.status }, "Didit session lookup failed");
      res.status(400).json({ error: "Could not verify session with Didit" });
      return;
    }

    const diditData = await diditRes.json() as any;
    const rawStatus: string = (diditData.status ?? diditData.kyc?.status ?? "").toLowerCase();
    const faceMatchScore: number | undefined = diditData.face_match_score ?? diditData.kyc?.face_match_score;
    const vendorData: string = diditData.vendor_data ?? payload.vendor_data ?? payload.vendorData ?? "";

    const userId = parseInt(vendorData, 10);
    if (!userId || isNaN(userId)) {
      req.log.warn({ sessionId, vendorData }, "KYC webhook: invalid vendor_data");
      res.status(400).json({ error: "Invalid vendor_data" });
      return;
    }

    // ── 3. Cross-validate session against our DB ─────────────────────────────
    let resolvedUserId: number | null = null;

    const [existingSub] = await db
      .select({ userId: kycSubmissionsTable.userId })
      .from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.diditSessionId, sessionId))
      .limit(1);

    if (existingSub) {
      resolvedUserId = existingSub.userId;
    } else {
      const [userBySession] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.kycSessionId, sessionId))
        .limit(1);
      if (userBySession) resolvedUserId = userBySession.id;
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

    // ── 4. Map Didit status → our status ─────────────────────────────────────
    const kycStatus =
      rawStatus === "approved" || rawStatus === "completed" ? "approved" :
      rawStatus === "declined" || rawStatus === "rejected" ? "rejected" : "pending";

    // ── 5. Idempotency guard ──────────────────────────────────────────────────
    const [currentUser] = await db
      .select({ kycStatus: usersTable.kycStatus })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (currentUser && currentUser.kycStatus === kycStatus) {
      res.json({ ok: true });
      return;
    }

    // ── 6. Apply update ───────────────────────────────────────────────────────
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
