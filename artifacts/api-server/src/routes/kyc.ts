import { Router } from "express";
import { Readable } from "node:stream";
import { get, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db, usersTable, kycSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();
const MAX_ID_IMAGE_BYTES = 5 * 1024 * 1024;
const ID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
        nationality: sub.nationality ?? null,
        documentType: sub.documentType ?? null,
        kycStatus: sub.kycStatus,
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

// External KYC session creation is disabled; identity uploads use the private
// Blob flow below and are reviewed by an admin.
router.post("/kyc/submit", requireAuth, async (req: AuthRequest, res) => {
  res.status(503).json({ error: "External identity verification is disabled." });
});

// Vercel Blob's completion callback is signed by Blob and does not use a user
// session. All client token requests must be authenticated.
router.post("/kyc/upload-url", (req, res, next) => {
  if (req.body?.type === "blob.upload-completed") {
    next();
    return;
  }
  requireAuth(req as AuthRequest, res, next);
}, async (req: AuthRequest, res) => {
  try {
    if (req.body?.type !== "blob.generate-client-token" &&
        req.body?.type !== "blob.upload-completed") {
      res.status(400).json({ error: "Invalid private upload request." });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(503).json({ error: "Private document storage is not configured." });
      return;
    }

    const result = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const expectedPrefix = `uploads/kyc/${req.userId}/`;
        if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
          throw new Error("Invalid document destination.");
        }
        const payload = JSON.parse(clientPayload || "{}") as {
          side?: unknown;
          name?: unknown;
          contentType?: unknown;
          size?: unknown;
        };
        if ((payload.side !== "front" && payload.side !== "back" && payload.side !== "selfie") ||
            typeof payload.name !== "string" || payload.name.trim().length < 1 ||
            payload.name.length > 180 || typeof payload.contentType !== "string" ||
            !ID_IMAGE_TYPES.has(payload.contentType) || !Number.isInteger(payload.size) ||
            Number(payload.size) < 1 || Number(payload.size) > MAX_ID_IMAGE_BYTES) {
          throw new Error("Choose a JPG, PNG, or WebP image up to 5 MB.");
        }
        return {
          allowedContentTypes: [payload.contentType],
          maximumSizeInBytes: MAX_ID_IMAGE_BYTES,
          tokenPayload: JSON.stringify({ userId: req.userId }),
        };
      },
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Could not create private KYC upload");
    res.status(400).json({ error: "Could not start the document upload." });
  }
});

// ─── POST /kyc/upload-documents — save private document paths ────────────────
router.post("/kyc/upload-documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      fullName, dateOfBirth, country, nationality, phoneNumber, nationalId,
      documentType, frontIdPath, backIdPath, selfieImagePath,
    } = req.body ?? {};
    const parsedBirthDate = typeof dateOfBirth === "string"
      ? new Date(`${dateOfBirth}T00:00:00.000Z`)
      : null;
    if (typeof fullName !== "string" || !fullName.trim() || fullName.length > 120 ||
        typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
        !parsedBirthDate || Number.isNaN(parsedBirthDate.getTime()) ||
        parsedBirthDate.toISOString().slice(0, 10) !== dateOfBirth ||
        parsedBirthDate > new Date() ||
        typeof country !== "string" || !country.trim() || country.length > 80 ||
        typeof nationality !== "string" || !nationality.trim() || nationality.length > 80 ||
        typeof phoneNumber !== "string" || !phoneNumber.trim() || phoneNumber.length > 32 ||
        typeof nationalId !== "string" || !nationalId.trim() || nationalId.length > 100 ||
        !["alien_id", "national_id", "passport", "driving_license"].includes(documentType) ||
        typeof frontIdPath !== "string" || typeof selfieImagePath !== "string" ||
        (documentType !== "passport" && typeof backIdPath !== "string") ||
        (documentType === "passport" && backIdPath != null && typeof backIdPath !== "string")) {
      res.status(400).json({ error: "Complete all required identity details and upload the required document and selfie images." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.kycStatus === "approved") {
      res.status(400).json({ error: "Identity already verified" }); return;
    }

    const userPrefix = `/objects/uploads/kyc/${req.userId}/`;
    const validObjectPath = (path: unknown): path is string =>
      typeof path === "string" && path.startsWith(userPrefix) &&
      !path.includes("..") && path.length <= 500;
    if (!validObjectPath(frontIdPath) || !validObjectPath(selfieImagePath) ||
        (backIdPath != null && !validObjectPath(backIdPath))) {
      res.status(400).json({ error: "The identity document upload is invalid." });
      return;
    }

    const existing = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, req.userId!))
      .orderBy(desc(kycSubmissionsTable.submittedAt));
    if (user.kycStatus === "pending" && existing[0]?.kycStatus === "pending_review") {
      res.status(409).json({ error: "Your identity check is already under review." });
      return;
    }
    if (existing.length >= 3) {
      res.status(429).json({ error: "Maximum KYC submissions reached. Contact support." }); return;
    }

    const checkBlob = async (path: string) => {
      const pathname = path.slice("/objects/".length);
      const blob = await head(pathname);
      if (!ID_IMAGE_TYPES.has(blob.contentType) ||
          blob.size < 1 || blob.size > MAX_ID_IMAGE_BYTES) {
        throw new Error("Document image type or size is invalid.");
      }
    };
    try {
      await checkBlob(frontIdPath);
      if (backIdPath) await checkBlob(backIdPath);
      await checkBlob(selfieImagePath);
    } catch {
      res.status(400).json({ error: "The document image could not be verified. Upload it again." });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(kycSubmissionsTable).values({
        userId: req.userId!,
        fullName: fullName.trim(),
        dateOfBirth,
        country: country.trim(),
        nationality: nationality.trim(),
        phoneNumber: phoneNumber.trim(),
        nationalId: nationalId.trim(),
        documentType,
        submissionMethod: "manual_upload",
        frontIdUrl: frontIdPath,
        backIdUrl: backIdPath ?? null,
        selfieImageUrl: selfieImagePath,
        kycStatus: "pending_review",
      });
      await tx.update(usersTable)
        .set({ kycStatus: "pending", kycSessionId: null })
        .where(eq(usersTable.id, req.userId!));
    });

    res.status(201).json({ ok: true, kycStatus: "pending_review" });
  } catch (err) {
    req.log.error({ err }, "Could not save KYC application");
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
      nationality: sub.nationality ?? null,
      phoneNumber: sub.phoneNumber,
      nationalId: sub.nationalId,
      submissionMethod: sub.submissionMethod,
      documentType: sub.documentType ?? null,
      frontIdPath: sub.frontIdUrl ?? null,
      backIdPath: sub.backIdUrl ?? null,
      selfieImagePath: sub.selfieImageUrl ?? null,
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

// Private ID image access is restricted to authenticated administrators.
router.get("/kyc/admin/submissions/:id/document/:side", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const side = req.params["side"];
    if (!Number.isSafeInteger(id) || id < 1 ||
        (side !== "front" && side !== "back" && side !== "selfie")) {
      res.status(400).json({ error: "Invalid document request." });
      return;
    }
    const [submission] = await db.select({
      userId: kycSubmissionsTable.userId,
      frontIdUrl: kycSubmissionsTable.frontIdUrl,
      backIdUrl: kycSubmissionsTable.backIdUrl,
      selfieImageUrl: kycSubmissionsTable.selfieImageUrl,
    }).from(kycSubmissionsTable).where(eq(kycSubmissionsTable.id, id));
    const objectPath = side === "front"
      ? submission?.frontIdUrl
      : side === "back" ? submission?.backIdUrl : submission?.selfieImageUrl;
    const expectedPrefix = submission ? `/objects/uploads/kyc/${submission.userId}/` : "";
    if (!objectPath || !objectPath.startsWith(expectedPrefix) || objectPath.includes("..")) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    const blob = await get(objectPath.slice("/objects/".length), { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream ||
        !ID_IMAGE_TYPES.has(blob.blob.contentType ?? "")) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    res.setHeader("Content-Type", blob.blob.contentType);
    if (blob.blob.size !== null) res.setHeader("Content-Length", String(blob.blob.size));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    Readable.fromWeb(blob.stream).on("error", (err) => res.destroy(err)).pipe(res);
  } catch (err) {
    req.log.error({ err }, "Could not stream private KYC document");
    if (!res.headersSent) res.status(500).json({ error: "Could not load document." });
    else res.destroy(err as Error);
  }
});

// ─── PUT /kyc/admin/submissions/:id/review — admin approve/reject ─────────────
router.put("/kyc/admin/submissions/:id/review", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const { action, rejectionReason } = req.body ?? {};
    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid submission." });
      return;
    }
    if (!["approve", "reject", "resubmit"].includes(action)) {
      res.status(400).json({ error: "action must be approve, reject, or resubmit" }); return;
    }
    const normalizedReason = typeof rejectionReason === "string" ? rejectionReason.trim() : "";
    if ((action === "reject" || action === "resubmit") &&
        (!normalizedReason || normalizedReason.length > 500)) {
      res.status(400).json({ error: "A reason of 1 to 500 characters is required for rejection or resubmission." });
      return;
    }

    const [sub] = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }

    const newSubStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "resubmit_required";
    const newUserStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "none";

    await db.transaction(async (tx) => {
      await tx.update(kycSubmissionsTable).set({
        kycStatus: newSubStatus,
        rejectionReason: action === "approve" ? null : normalizedReason,
        reviewedAt: new Date(),
        reviewedBy: req.userId,
      }).where(eq(kycSubmissionsTable.id, id));

      await tx.update(usersTable).set({
        kycStatus: newUserStatus,
      }).where(eq(usersTable.id, sub.userId));
    });

    res.json({
      ok: true,
      kycStatus: newUserStatus,
      rejectionReason: action === "approve" ? null : normalizedReason,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// External verification sessions are intentionally disabled.
router.post("/kyc/session", requireAuth, async (req: AuthRequest, res) => {
  res.status(503).json({ error: "External identity verification is disabled." });
});

export default router;
