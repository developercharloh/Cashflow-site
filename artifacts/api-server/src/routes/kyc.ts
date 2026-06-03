import { Router } from "express";
import { db, usersTable, kycSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

const CLIENT_ID = process.env.DIDIT_CLIENT_ID ?? "d32f2c6e-b8c7-4d1b-9212-e7d552ab0863";
const CLIENT_SECRET = process.env.DIDIT_CLIENT_SECRET!;
const DIDIT_TOKEN_URL = "https://apx.didit.me/auth/v2/token/";
const DIDIT_SESSIONS_URL = "https://apx.didit.me/v2/sessions/";
const CALLBACK_URL = "https://taskearn-pro.vercel.app/profile?kyc=done";

async function getAccessToken(): Promise<string> {
  if (!CLIENT_SECRET) throw new Error("DIDIT_CLIENT_SECRET environment variable is not set");
  // Didit requires Basic auth header — credentials in body always returns 403
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(DIDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token) {
    const detail = data.error_description ?? data.error ?? data.detail ?? JSON.stringify(data);
    throw new Error(`Didit auth failed (${res.status}): ${detail}`);
  }
  return data.access_token;
}

// ─── GET /kyc/status ──────────────────────────────────────────────────────────
router.get("/kyc/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      kycStatus: usersTable.kycStatus,
      kycSessionId: usersTable.kycSessionId,
    }).from(usersTable).where(eq(usersTable.id, req.userId!));

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Also get latest submission details
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

// ─── POST /kyc/submit — collect personal info + create Didit session ──────────
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

    // Create Didit session
    let token: string;
    try {
      token = await getAccessToken();
    } catch (authErr) {
      req.log.error(authErr, "Didit auth error");
      res.status(503).json({ error: (authErr as Error).message }); return;
    }
    const sessionRes = await fetch(DIDIT_SESSIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ callback: CALLBACK_URL, vendor_data: String(req.userId) }),
    });
    const session = await sessionRes.json() as any;
    const sessionUrl: string = session.url ?? session.session_url;
    const sessionId: string = session.session_id ?? session.id;

    if (!sessionUrl) {
      req.log.error({ session }, "Didit session creation failed");
      res.status(400).json({ error: session.detail ?? session.message ?? `Didit error ${sessionRes.status}: ${JSON.stringify(session)}` });
      return;
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
      diditSessionId: sessionId,
    });

    // Update user status
    await db.update(usersTable)
      .set({ kycStatus: "pending", kycSessionId: sessionId })
      .where(eq(usersTable.id, req.userId!));

    res.json({ url: sessionUrl, sessionId });
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

// ─── POST /kyc/session — legacy: create session without pre-form ──────────────
router.post("/kyc/session", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }
    const token = await getAccessToken();
    const sessionRes = await fetch(DIDIT_SESSIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ callback: CALLBACK_URL, vendor_data: String(req.userId) }),
    });
    const session = await sessionRes.json() as any;
    const sessionUrl: string = session.url ?? session.session_url;
    const sessionId: string = session.session_id ?? session.id;
    if (!sessionUrl) {
      res.status(400).json({ error: session.detail ?? "Failed to create verification session" }); return;
    }
    await db.update(usersTable).set({ kycStatus: "pending", kycSessionId: sessionId }).where(eq(usersTable.id, req.userId!));
    res.json({ url: sessionUrl, sessionId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/webhook — Didit calls this on completion ──────────────────────
router.post("/kyc/webhook", async (req, res) => {
  try {
    const payload = req.body as any;
    const status: string = (payload.status ?? "").toUpperCase();
    const vendorData: string = payload.vendor_data ?? payload.vendorData ?? "";
    const sessionId: string = payload.session_id ?? payload.sessionId ?? "";
    const faceMatchScore: number | undefined = payload.face_match_score ?? payload.faceMatchScore;

    const userId = parseInt(vendorData, 10);
    if (!userId || isNaN(userId)) { res.status(400).json({ error: "Invalid vendor_data" }); return; }

    const kycStatus =
      status === "APPROVED" || status === "COMPLETED" ? "approved" :
      status === "DECLINED" || status === "REJECTED" ? "rejected" : "pending";

    await db.update(usersTable).set({ kycStatus, kycSessionId: sessionId || undefined }).where(eq(usersTable.id, userId));

    // Update matching submission record
    if (sessionId) {
      await db.update(kycSubmissionsTable).set({
        kycStatus,
        faceMatchScore: faceMatchScore ?? null,
        reviewedAt: new Date(),
      }).where(eq(kycSubmissionsTable.diditSessionId, sessionId));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("KYC webhook error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
