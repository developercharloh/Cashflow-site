import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "pino-http";
import { db } from "@workspace/db";
import { del, get, list } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { verifyToken } from "../src/lib/auth";
import kycRouter from "../src/routes/kyc";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  list: vi.fn(),
  del: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    transaction: mocks.transaction,
  },
  usersTable: { id: "users.id", kycStatus: "users.kycStatus", kycSessionId: "users.kycSessionId" },
  kycSubmissionsTable: {
    id: "kyc.id",
    userId: "kyc.userId",
    frontIdUrl: "kyc.frontIdUrl",
    backIdUrl: "kyc.backIdUrl",
    selfieImageUrl: "kyc.selfieImageUrl",
    submittedAt: "kyc.submittedAt",
  },
  kycUploadCleanupRunsTable: {
    id: "cleanup.id",
    ranAt: "cleanup.ranAt",
    adminId: "cleanup.adminId",
    cutoff: "cleanup.cutoff",
    mode: "cleanup.mode",
    scanned: "cleanup.scanned",
    olderThanCutoff: "cleanup.olderThanCutoff",
    referenced: "cleanup.referenced",
    eligible: "cleanup.eligible",
    deleted: "cleanup.deleted",
    pages: "cleanup.pages",
    hasMore: "cleanup.hasMore",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  del: mocks.del,
  get: vi.fn(),
  head: vi.fn(),
  list: mocks.list,
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  verifyToken: vi.fn((token: string) => {
    if (token === "worker") return { userId: 7, isAdmin: false };
    if (token === "admin") return { userId: 1, isAdmin: true };
    return null;
  }),
}));

function userRecord(isAdmin = false) {
  return { id: isAdmin ? 1 : 7, isAdmin, isBanned: false, kycStatus: "pending", kycSessionId: null };
}

function submissionRecord() {
  return {
    id: 42,
    userId: 7,
    fullName: "Test Worker",
    country: "Kenya",
    nationality: "Kenyan",
    documentType: "national_id",
    kycStatus: "pending_review",
    submittedAt: new Date("2025-01-02T00:00:00.000Z"),
    rejectionReason: null,
    faceMatchScore: null,
    frontIdUrl: "/objects/uploads/kyc/7/front.jpg",
    backIdUrl: "/objects/uploads/kyc/7/back.jpg",
    selfieImageUrl: "/objects/uploads/kyc/7/selfie.jpg",
  };
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: mocks.logError, info: mocks.logInfo } });
    next();
  });
  app.use("/api", kycRouter);
  return app;
}

async function request(
  app: Express,
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    return await fetch(`http://127.0.0.1:${address.port}${url}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function queueSelectResults(...results: unknown[][]) {
  mocks.selectResults.push(...results);
}

function authenticatedAdminReads() {
  return [[userRecord(true)], [userRecord(true)]];
}

function blob(pathname: string, uploadedAt = new Date("2020-01-01T00:00:00.000Z")) {
  return {
    pathname,
    url: `https://example.invalid/${pathname}`,
    downloadUrl: `https://example.invalid/${pathname}`,
    size: 10,
    uploadedAt,
    etag: "etag",
  };
}

beforeEach(() => {
  mocks.selectResults.length = 0;
  mocks.select.mockImplementation(() => {
    const result = mocks.selectResults.shift() ?? [];
    let query: Record<string, unknown> & { then: Promise<unknown>["then"] };
    query = {
      from: vi.fn(() => query),
      where: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(() => Promise.resolve(result)),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
  });
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
    }),
  );
  mocks.insert.mockImplementation(() => ({
    values: vi.fn(async () => undefined),
  }));
  mocks.list.mockResolvedValue({ blobs: [], hasMore: false });
  mocks.del.mockResolvedValue(undefined);
  mocks.logError.mockReset();
  mocks.logInfo.mockReset();
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  vi.mocked(handleUpload).mockImplementation(async ({ body, onBeforeGenerateToken }) => {
    const requestBody = body as unknown as { pathname: string; clientPayload: string };
    await onBeforeGenerateToken(requestBody.pathname, requestBody.clientPayload, false);
    return { type: "blob.generate-client-token", clientToken: "test-client-token" };
  });
  vi.mocked(get).mockImplementation(async () => ({
    statusCode: 200,
    blob: {
      contentType: "image/jpeg",
      size: 2,
      pathname: "uploads/kyc/7/front.jpg",
      url: "https://example.invalid/front.jpg",
      downloadUrl: "https://example.invalid/front.jpg?download=1",
      contentDisposition: "inline",
      cacheControl: "private, no-store",
      uploadedAt: new Date("2025-01-02T00:00:00.000Z"),
      etag: "test-etag",
    },
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.close();
      },
    }),
    headers: new Headers(),
  }));
});

afterEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("private KYC routes", () => {
  it("allows uploads only within the authenticated worker's storage prefix", async () => {
    const app = createApp();
    queueSelectResults([userRecord()]);

    const response = await request(app, "/api/kyc/upload-url", {
      method: "POST",
      token: "worker",
      body: {
        type: "blob.generate-client-token",
        pathname: "uploads/kyc/7/front.jpg",
        clientPayload: JSON.stringify({
          side: "front",
          name: "front.jpg",
          contentType: "image/jpeg",
          size: 1200,
        }),
      },
    });
    expect(response.status).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith("worker");

    mocks.selectResults.length = 0;
    queueSelectResults([userRecord()]);
    const otherUserResponse = await request(app, "/api/kyc/upload-url", {
      method: "POST",
      token: "worker",
      body: {
        type: "blob.generate-client-token",
        pathname: "uploads/kyc/8/front.jpg",
        clientPayload: JSON.stringify({
          side: "front",
          name: "front.jpg",
          contentType: "image/jpeg",
          size: 1200,
        }),
      },
    });
    expect(otherUserResponse.status).toBe(400);
  });

  it.each([
    ["unsupported GIF", "image/gif", 1200],
    ["oversized image", "image/jpeg", 5 * 1024 * 1024 + 1],
  ])("rejects %s before issuing an upload token", async (_label, contentType, size) => {
    const app = createApp();
    queueSelectResults([userRecord()]);
    const response = await request(app, "/api/kyc/upload-url", {
      method: "POST",
      token: "worker",
      body: {
        type: "blob.generate-client-token",
        pathname: "uploads/kyc/7/front.jpg",
        clientPayload: JSON.stringify({
          side: "front",
          name: "front.jpg",
          contentType,
          size,
        }),
      },
    });
    expect(response.status).toBe(400);
    expect(handleUpload).toHaveBeenCalledTimes(1);
  });

  it.each(["reject", "resubmit"])("rejects blank %s reasons", async (action) => {
    const app = createApp();
    queueSelectResults([userRecord(true)], [userRecord(true)]);
    const response = await request(app, "/api/kyc/admin/submissions/42/review", {
      method: "PUT",
      token: "admin",
      body: { action, rejectionReason: " \n " },
    });
    expect(response.status).toBe(400);
    expect(mocks.selectResults).toHaveLength(0);
  });

  it("serves front, back, and selfie images only to authenticated admins", async () => {
    const app = createApp();

    for (const side of ["front", "back", "selfie"]) {
      queueSelectResults([userRecord()], [userRecord()]);
      const workerResponse = await request(
        app,
        `/api/kyc/admin/submissions/42/document/${side}`,
        { token: "worker" },
      );
      expect(workerResponse.status).toBe(403);
    }

    for (const side of ["front", "back", "selfie"]) {
      queueSelectResults(...authenticatedAdminReads(), [submissionRecord()]);
      const adminResponse = await request(
        app,
        `/api/kyc/admin/submissions/42/document/${side}`,
        { token: "admin" },
      );
      expect(adminResponse.status, await adminResponse.clone().text()).toBe(200);
      expect(adminResponse.headers.get("cache-control")).toBe("private, no-store");
      expect(adminResponse.headers.get("x-content-type-options")).toBe("nosniff");
      expect(get).toHaveBeenLastCalledWith(`uploads/kyc/7/${side}.jpg`, {
        access: "private",
        useCache: false,
      });
    }

    for (const side of ["front", "back", "selfie"]) {
      const unauthenticatedResponse = await request(
        app,
        `/api/kyc/admin/submissions/42/document/${side}`,
      );
      expect(unauthenticatedResponse.status).toBe(401);
    }
  });

  it("does not include private image paths in a worker's KYC status response", async () => {
    const app = createApp();
    queueSelectResults(
      [userRecord()],
      [{
        ...submissionRecord(),
        nationalId: "PRIVATE-ID-NUMBER",
      }],
    );
    const response = await request(app, "/api/kyc/status", { token: "worker" });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain("/objects/uploads/kyc/");
    expect(serialized).not.toContain("frontIdPath");
    expect(serialized).not.toContain("backIdPath");
    expect(serialized).not.toContain("selfieImagePath");
    expect(serialized).not.toContain("PRIVATE-ID-NUMBER");
  });

  it("records successful cleanup counts without retaining private object paths", async () => {
    const app = createApp();
    queueSelectResults(...authenticatedAdminReads(), []);
    vi.mocked(list).mockResolvedValue({
      blobs: [blob("uploads/kyc/7/abandoned.jpg")],
      hasMore: false,
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
      body: { dryRun: false },
    });
    const values = mocks.insert.mock.results[0]?.value.values;

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.anything());
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 1,
      mode: "deletion",
      scanned: 1,
      olderThanCutoff: 1,
      referenced: 0,
      eligible: 1,
      deleted: 1,
      pages: 1,
      hasMore: false,
    }));
    expect(JSON.stringify(values.mock.calls)).not.toContain("uploads/kyc/");
  });

  it("returns only sanitized cleanup history fields to administrators", async () => {
    const app = createApp();
    queueSelectResults(...authenticatedAdminReads(), [{
      id: 12,
      ranAt: new Date("2025-01-03T12:00:00.000Z"),
      adminId: 1,
      cutoff: new Date("2025-01-02T12:00:00.000Z"),
      mode: "preview",
      scanned: 10,
      olderThanCutoff: 4,
      referenced: 2,
      eligible: 2,
      deleted: 0,
      pages: 1,
      hasMore: false,
      privatePath: "uploads/kyc/7/private.jpg",
    }]);

    const response = await request(app, "/api/kyc/admin/uploads/cleanup/history", { token: "admin" });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"adminId":1');
    expect(body).toContain('"mode":"preview"');
    expect(body).not.toContain("privatePath");
    expect(body).not.toContain("uploads/kyc/");
  });

  it("does not allow workers to read KYC upload cleanup history", async () => {
    queueSelectResults([userRecord()], [userRecord()]);
    const response = await request(createApp(), "/api/kyc/admin/uploads/cleanup/history", { token: "worker" });

    expect(response.status).toBe(403);
  });

  it("dry-runs only old unreferenced KYC uploads and protects every submission status", async () => {
    const app = createApp();
    const submissions = [
      { frontIdUrl: "/objects/uploads/kyc/7/pending-front.jpg", backIdUrl: null, selfieImageUrl: null, kycStatus: "pending_review" },
      { frontIdUrl: null, backIdUrl: "/objects/uploads/kyc/7/approved-back.jpg", selfieImageUrl: null, kycStatus: "approved" },
      { frontIdUrl: null, backIdUrl: null, selfieImageUrl: "/objects/uploads/kyc/7/rejected-selfie.jpg", kycStatus: "rejected" },
      { frontIdUrl: "/objects/uploads/kyc/7/resubmit-front.jpg", backIdUrl: null, selfieImageUrl: null, kycStatus: "resubmit_required" },
    ];
    const uploadedAt = new Date("2020-01-01T00:00:00.000Z");
    queueSelectResults(...authenticatedAdminReads(), submissions);
    vi.mocked(list).mockResolvedValue({
      blobs: [
        ...[
          "pending-front.jpg",
          "approved-back.jpg",
          "rejected-selfie.jpg",
          "resubmit-front.jpg",
        ].map((filename) => ({
          pathname: `uploads/kyc/7/${filename}`,
          url: `https://example.invalid/${filename}`,
          downloadUrl: `https://example.invalid/${filename}`,
          size: 10,
          uploadedAt,
          etag: "etag",
        })),
        {
          pathname: "uploads/kyc/7/abandoned.jpg",
          url: "https://example.invalid/abandoned.jpg",
          downloadUrl: "https://example.invalid/abandoned.jpg",
          size: 10,
          uploadedAt,
          etag: "etag",
        },
        {
          pathname: "uploads/kyc/7/recent.jpg",
          url: "https://example.invalid/recent.jpg",
          downloadUrl: "https://example.invalid/recent.jpg",
          size: 10,
          uploadedAt: new Date(Date.now() + 60_000),
          etag: "etag",
        },
      ],
      hasMore: false,
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      dryRun: true,
      scanned: 6,
      olderThanCutoff: 5,
      referenced: 4,
      eligible: 1,
      deleted: 0,
      pages: 1,
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("retains uploads at and newer than the fixed retention cutoff", async () => {
    const app = createApp();
    const fixedNow = new Date("2025-01-03T12:00:00.000Z");
    const cutoff = new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000);
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow.getTime());
    queueSelectResults(...authenticatedAdminReads(), []);
    vi.mocked(list).mockResolvedValue({
      blobs: [
        blob("uploads/kyc/7/just-before-cutoff.jpg", new Date(cutoff.getTime() - 1)),
        blob("uploads/kyc/7/exactly-at-cutoff.jpg", cutoff),
        blob("uploads/kyc/7/just-after-cutoff.jpg", new Date(cutoff.getTime() + 1)),
      ],
      hasMore: false,
    });

    try {
      const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
        method: "POST",
        token: "admin",
        body: { dryRun: false },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject({
        cutoff: cutoff.toISOString(),
        scanned: 3,
        olderThanCutoff: 1,
        eligible: 1,
        deleted: 1,
      });
      expect(del).toHaveBeenCalledExactlyOnceWith(["uploads/kyc/7/just-before-cutoff.jpg"]);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("deletes only eligible stale objects when an admin explicitly disables dry-run", async () => {
    const app = createApp();
    queueSelectResults(...authenticatedAdminReads(), [
      { frontIdUrl: "/objects/uploads/kyc/7/linked.jpg", backIdUrl: null, selfieImageUrl: null },
    ]);
    vi.mocked(list).mockResolvedValue({
      blobs: ["linked.jpg", "abandoned.jpg"].map((filename) => ({
        pathname: `uploads/kyc/7/${filename}`,
        url: `https://example.invalid/${filename}`,
        downloadUrl: `https://example.invalid/${filename}`,
        size: 10,
        uploadedAt: new Date("2020-01-01T00:00:00.000Z"),
        etag: "etag",
      })),
      hasMore: false,
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
      body: { dryRun: false },
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ dryRun: false, referenced: 1, eligible: 1, deleted: 1 });
    expect(del).toHaveBeenCalledWith(["uploads/kyc/7/abandoned.jpg"]);
  });

  it("never deletes malformed or traversal-like paths from the storage listing", async () => {
    const app = createApp();
    queueSelectResults(...authenticatedAdminReads(), []);
    vi.mocked(list).mockResolvedValue({
      blobs: [
        blob("uploads/kyc/7/abandoned.jpg"),
        blob("uploads/kyc/7/../outside.jpg"),
        blob("uploads/kyc/7/%2e%2e%2foutside.jpg"),
        blob("uploads/kyc/7/%252e%252e%255coutside.jpg"),
        blob("uploads/kyc/7/."),
        blob("uploads/kyc/7/.."),
        blob("uploads/kyc/007/leading-zero-user.jpg"),
        blob("uploads/kyc/0/zero-user.jpg"),
        blob("uploads/kyc/7\\outside.jpg"),
        blob("uploads/kyc/7/nested/folder.jpg"),
        blob("uploads/kyc/7/%not-encoded.jpg"),
      ],
      hasMore: false,
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
      body: { dryRun: false },
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ scanned: 11, olderThanCutoff: 1, eligible: 1, deleted: 1 });
    expect(del).toHaveBeenCalledExactlyOnceWith(["uploads/kyc/7/abandoned.jpg"]);
  });

  it("stops after five pages and forwards each returned cursor", async () => {
    const app = createApp();
    const referencedPath = "uploads/kyc/7/retained.jpg";
    queueSelectResults(...authenticatedAdminReads(), [
      { frontIdUrl: `/objects/${referencedPath}`, backIdUrl: null, selfieImageUrl: null },
    ]);
    vi.mocked(list).mockImplementation(async ({ cursor } = {}) => {
      const pageNumber = cursor ? Number(String(cursor).replace("cursor-", "")) + 1 : 1;
      const blobs = Array.from({ length: 1000 }, (_, index) =>
        pageNumber === 1 && index === 0
          ? blob(referencedPath)
          : blob(
              `uploads/kyc/${pageNumber}/recent-${index}.jpg`,
              new Date(Date.now() + 60_000),
            ),
      );
      return { blobs, hasMore: true, cursor: `cursor-${pageNumber}` };
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
    });
    const result = await response.json();
    const listCalls = vi.mocked(list).mock.calls;

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ scanned: 5000, referenced: 1, eligible: 0, pages: 5, hasMore: true });
    expect(listCalls).toHaveLength(5);
    expect(listCalls.map(([options]) => options)).toEqual([
      expect.objectContaining({ limit: 1000, prefix: "uploads/kyc/" }),
      expect.objectContaining({ cursor: "cursor-1" }),
      expect.objectContaining({ cursor: "cursor-2" }),
      expect.objectContaining({ cursor: "cursor-3" }),
      expect.objectContaining({ cursor: "cursor-4" }),
    ]);
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes at most 100 stale objects and never deletes referenced images", async () => {
    const app = createApp();
    const referencedPath = "uploads/kyc/7/retained.jpg";
    queueSelectResults(...authenticatedAdminReads(), [
      { frontIdUrl: `/objects/${referencedPath}`, backIdUrl: null, selfieImageUrl: null },
    ]);
    vi.mocked(list).mockResolvedValue({
      blobs: [
        blob(referencedPath),
        ...Array.from({ length: 150 }, (_, index) => blob(`uploads/kyc/7/abandoned-${index}.jpg`)),
      ],
      hasMore: true,
      cursor: "next-page",
    });

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
      body: { dryRun: false },
    });
    const result = await response.json();
    const deletedPaths = vi.mocked(del).mock.calls[0]?.[0] as string[];

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      referenced: 1,
      eligible: 100,
      deleted: 100,
      pages: 1,
      hasMore: true,
    });
    expect(deletedPaths).toHaveLength(100);
    expect(deletedPaths).not.toContain(referencedPath);
  });

  it("returns and logs listing failures without exposing private object paths", async () => {
    const app = createApp();
    const referencedPath = "uploads/kyc/7/retained.jpg";
    queueSelectResults(...authenticatedAdminReads(), [
      { frontIdUrl: `/objects/${referencedPath}`, backIdUrl: null, selfieImageUrl: null },
    ]);
    vi.mocked(list).mockRejectedValue(new Error(`Unable to list ${referencedPath}`));

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
    });
    const responseBody = await response.text();
    const loggedDetails = JSON.stringify(mocks.logError.mock.calls);

    expect(response.status).toBe(500);
    expect(responseBody).not.toContain(referencedPath);
    expect(loggedDetails).toContain('"stage":"listing"');
    expect(loggedDetails).not.toContain(referencedPath);
    expect(del).not.toHaveBeenCalled();
  });

  it("returns and logs deletion failures without exposing private object paths", async () => {
    const app = createApp();
    const referencedPath = "uploads/kyc/7/retained.jpg";
    const abandonedPath = "uploads/kyc/7/abandoned.jpg";
    queueSelectResults(...authenticatedAdminReads(), [
      { frontIdUrl: `/objects/${referencedPath}`, backIdUrl: null, selfieImageUrl: null },
    ]);
    vi.mocked(list).mockResolvedValue({
      blobs: [blob(referencedPath), blob(abandonedPath)],
      hasMore: false,
    });
    vi.mocked(del).mockRejectedValue(new Error(`Unable to delete ${abandonedPath}`));

    const response = await request(app, "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "admin",
      body: { dryRun: false },
    });
    const responseBody = await response.text();
    const loggedDetails = JSON.stringify(mocks.logError.mock.calls);

    expect(response.status).toBe(500);
    expect(responseBody).not.toContain(abandonedPath);
    expect(loggedDetails).toContain('"stage":"deletion"');
    expect(loggedDetails).not.toContain(abandonedPath);
    expect(loggedDetails).not.toContain(referencedPath);
    expect(del).toHaveBeenCalledWith([abandonedPath]);
    expect(del).not.toHaveBeenCalledWith(expect.arrayContaining([referencedPath]));
  });

  it("does not allow workers to run KYC upload cleanup", async () => {
    queueSelectResults([userRecord()], [userRecord()]);
    const response = await request(createApp(), "/api/kyc/admin/uploads/cleanup", {
      method: "POST",
      token: "worker",
      body: { dryRun: false },
    });
    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
