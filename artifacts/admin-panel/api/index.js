import app from "../../api-server/dist/vercel.mjs";

export default function handler(req, res) {
  const requestUrl = new URL(req.url ?? "/", "http://vercel.local");
  const route = requestUrl.searchParams.get("route");

  if (!route || route.split("/").some((segment) => segment === "..")) {
    res.status(400).json({ error: "Invalid API route." });
    return;
  }

  requestUrl.searchParams.delete("route");
  req.url = `/api/${route.replace(/^\/+/, "")}${requestUrl.search}`;
  return app(req, res);
}
