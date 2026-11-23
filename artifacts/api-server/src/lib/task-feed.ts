import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

export const TASK_FEED_CATEGORIES = [
  "Academic Writing",
  "Data Entry",
  "Transcription",
  "AI Training",
] as const;

export type TaskFeedCategory = (typeof TASK_FEED_CATEGORIES)[number];

export type NormalizedFeedTask = {
  externalId: string;
  title: string;
  description: string;
  instructions: string;
  category: TaskFeedCategory;
  estimatedMinutes: number;
  sourceUrl: string;
};

export type ParsedTaskFeed = {
  tasks: NormalizedFeedTask[];
  skippedUnsupported: number;
  skippedInvalid: number;
};

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 255 && b === 255 && c === 255)
  );
}

async function getPublicIpv4(hostname: string): Promise<string> {
  if (isIP(hostname)) {
    if (!isPublicIpv4(hostname)) throw new Error("The feed address must be a public HTTPS hostname.");
    return hostname;
  }
  if (!hostname.includes(".") || hostname.endsWith(".local") || hostname === "localhost") {
    throw new Error("The feed address must use a public hostname.");
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  const ipv4Addresses = resolved.filter((entry) => isIP(entry.address) === 4);
  if (!ipv4Addresses.length || ipv4Addresses.some((entry) => !isPublicIpv4(entry.address))) {
    throw new Error("The feed hostname must resolve only to public IPv4 addresses.");
  }
  return ipv4Addresses[0]!.address;
}

function assertPublicFeedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid feed URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search ||
    url.hash
  ) {
    throw new Error("Feeds must be public HTTPS URLs without credentials, query parameters, or redirects.");
  }
  return url;
}

async function fetchJson(url: URL): Promise<unknown> {
  const pinnedIp = await getPublicIpv4(url.hostname);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const request = httpsRequest({
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.hostname,
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "user-agent": "LipwaTasks-licensed-feed/1.0",
      },
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, pinnedIp, 4);
      }) as never,
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        finish(() => reject(new Error(status >= 300 && status < 400
          ? "The feed redirected. Use its final HTTPS URL."
          : `The feed returned HTTP ${status}.`)));
        return;
      }
      const contentType = response.headers["content-type"]?.toLowerCase() ?? "";
      if (!contentType.includes("application/json") && !contentType.includes("+json")) {
        response.resume();
        finish(() => reject(new Error("The feed must return JSON.")));
        return;
      }
      const contentLength = Number(response.headers["content-length"] ?? 0);
      if (contentLength > 2_000_000) {
        response.resume();
        finish(() => reject(new Error("The feed is larger than the 2 MB limit.")));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > 2_000_000) {
          request.destroy(new Error("The feed is larger than the 2 MB limit."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        finish(() => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("The feed did not contain valid JSON."));
          }
        });
      });
      response.on("error", (error) => finish(() => reject(error)));
    });

    request.setTimeout(10_000, () => request.destroy(new Error("The feed request timed out.")));
    request.on("error", (error) => finish(() => reject(error)));
    request.end();
  });
}

function validTaskUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function readTaskFeed(
  feedUrl: string,
  allowedCategories: string[],
): Promise<ParsedTaskFeed> {
  const payload = await fetchJson(assertPublicFeedUrl(feedUrl));
  return parseTaskFeedPayload(payload, allowedCategories);
}

export function parseTaskFeedPayload(
  payload: unknown,
  allowedCategories: string[],
): ParsedTaskFeed {
  if (!payload || typeof payload !== "object") {
    throw new Error("The feed response must be a JSON object.");
  }
  const record = payload as { format?: unknown; tasks?: unknown };
  if (record.format !== "lipwa-task-feed/v1" || !Array.isArray(record.tasks)) {
    throw new Error("Feed format must be lipwa-task-feed/v1 with a tasks array.");
  }
  if (record.tasks.length > 100) {
    throw new Error("A feed sync can contain no more than 100 tasks.");
  }

  const supported = new Set<string>(TASK_FEED_CATEGORIES);
  const allowed = new Set(allowedCategories);
  const tasks: NormalizedFeedTask[] = [];
  let skippedUnsupported = 0;
  let skippedInvalid = 0;

  for (const value of record.tasks) {
    if (!value || typeof value !== "object") {
      skippedInvalid++;
      continue;
    }
    const task = value as Record<string, unknown>;
    if (typeof task.category !== "string" || !supported.has(task.category) || !allowed.has(task.category)) {
      skippedUnsupported++;
      continue;
    }

    const valid =
      typeof task.id === "string" && task.id.trim().length > 0 && task.id.length <= 200 &&
      typeof task.title === "string" && task.title.trim().length >= 5 && task.title.length <= 160 &&
      typeof task.description === "string" && task.description.trim().length >= 10 && task.description.length <= 3_000 &&
      typeof task.instructions === "string" && task.instructions.trim().length >= 50 && task.instructions.length <= 10_000 &&
      Number.isInteger(task.estimatedMinutes) && Number(task.estimatedMinutes) >= 1 && Number(task.estimatedMinutes) <= 1_440 &&
      validTaskUrl(task.taskUrl);
    if (!valid) {
      skippedInvalid++;
      continue;
    }

    const externalId = task.id as string;
    const title = task.title as string;
    const description = task.description as string;
    const instructions = task.instructions as string;
    const sourceUrl = task.taskUrl as string;
    tasks.push({
      externalId: externalId.trim(),
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      category: task.category as TaskFeedCategory,
      estimatedMinutes: Number(task.estimatedMinutes),
      sourceUrl,
    });
  }

  return { tasks, skippedUnsupported, skippedInvalid };
}
