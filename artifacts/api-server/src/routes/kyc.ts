import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

const CLIENT_ID = process.env.DIDIT_CLIENT_ID ?? "d32f2c6e-b8c7-4d1b-9212-e7d552ab0863";
const CLIENT_SECRET = process.env.DIDIT_CLIENT_SECRET!;
const DIDIT_TOKEN_URL = "https://apx.didit.me/auth/v2/token/";
const DIDIT_SESSIONS_URL = "https://apx.didit.me/v2/sessions/";
const CALLBACK_URL = "https://taskearn-pro.vercel.app/profile?kyc=done";

// ─── Get Didit OAuth2 access token (client credentials) ──────────────────────
async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(DIDIT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error(data.error_description ?? "Failed to get Didit token");
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
    res.json({ kycStatus: user.kycStatus, kycSessionId: user.kycSessionId ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/session — create Didit verification session ───────────────────
router.post("/kyc/session", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Already approved — no need to re-verify
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }

    const token = await getAccessToken();

    const sessionRes = await fetch(DIDIT_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback: CALLBACK_URL,
        vendor_data: String(req.userId),
      }),
    });

    const session = await sessionRes.json() as any;
    if (!session.url && !session.session_url) {
      req.log.error({ session }, "Didit session creation failed");
      res.status(400).json({ error: session.detail ?? session.message ?? "Failed to create verification session" });
      return;
    }

    const sessionUrl: string = session.url ?? session.session_url;
    const sessionId: string = session.session_id ?? session.id;

    // Mark user as pending + store session id
    await db.update(usersTable)
      .set({ kycStatus: "pending", kycSessionId: sessionId })
      .where(eq(usersTable.id, req.userId!));

    res.json({ url: sessionUrl, sessionId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /kyc/webhook — Didit calls this when verification completes ─────────
router.post("/kyc/webhook", async (req, res) => {
  try {
    const payload = req.body as any;
    const status: string = (payload.status ?? "").toUpperCase();
    const vendorData: string = payload.vendor_data ?? payload.vendorData ?? "";
    const sessionId: string = payload.session_id ?? payload.sessionId ?? "";

    const userId = parseInt(vendorData, 10);
    if (!userId || isNaN(userId)) {
      res.status(400).json({ error: "Invalid vendor_data" }); return;
    }

    const kycStatus =
      status === "APPROVED" || status === "COMPLETED" ? "approved" :
      status === "DECLINED" || status === "REJECTED" ? "rejected" : "pending";

    await db.update(usersTable)
      .set({ kycStatus, kycSessionId: sessionId || undefined })
      .where(eq(usersTable.id, userId));

    res.json({ ok: true });
  } catch (err) {
    console.error("KYC webhook error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
