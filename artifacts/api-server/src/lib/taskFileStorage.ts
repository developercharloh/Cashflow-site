import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseObjectPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [empty, bucketName, ...objectParts] = normalized.split("/");
  if (empty !== "" || !bucketName || objectParts.length === 0) throw new Error("Invalid object path");
  return { bucketName, objectName: objectParts.join("/") };
}

export async function createTaskUploadUrl(userId: number) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("App Storage is not configured");
  const objectPath = `${privateDir.replace(/\/$/, "")}/uploads/task-submissions/${userId}/${randomUUID()}`;
  const { bucketName, objectName } = parseObjectPath(objectPath);
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: expiresAt.toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not create upload URL (${response.status})`);
  const result = await response.json() as { signed_url?: string };
  if (!result.signed_url) throw new Error("Storage returned no upload URL");
  return { uploadURL: result.signed_url, objectPath: `/objects/${objectName}` };
}

export async function getTaskFileMetadata(objectPath: string) {
  if (!objectPath.startsWith("/objects/uploads/task-submissions/")) return null;
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.replace(/\/$/, "");
  if (!privateDir) throw new Error("App Storage is not configured");
  const { bucketName, objectName } = parseObjectPath(`${privateDir}${objectPath.slice("/objects".length)}`);
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [metadata] = await file.getMetadata();
  return { size: Number(metadata.size ?? 0), contentType: String(metadata.contentType ?? "") };
}

export async function streamTaskFile(objectPath: string, res: import("express").Response) {
  if (!objectPath.startsWith("/objects/uploads/task-submissions/")) throw new Error("Invalid task file path");
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.replace(/\/$/, "");
  if (!privateDir) throw new Error("App Storage is not configured");
  const { bucketName, objectName } = parseObjectPath(`${privateDir}${objectPath.slice("/objects".length)}`);
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return false;
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", String(metadata.contentType ?? "application/octet-stream"));
  res.setHeader("Content-Length", String(metadata.size ?? ""));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "attachment");
  file.createReadStream().on("error", (error) => res.destroy(error)).pipe(res);
  return true;
}
