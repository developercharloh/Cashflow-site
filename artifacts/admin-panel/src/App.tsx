import { useEffect } from "react";

const ADMIN_DESTINATIONS: Record<string, string> = {
  "/": "/admin/login",
  "/login": "/admin/login",
  "/users": "/admin/users",
  "/tasks": "/admin/tasks",
  "/withdrawals": "/admin/withdrawals",
  "/kyc": "/admin/kyc",
  "/activity": "/admin/audit-log",
};

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const destination = ADMIN_DESTINATIONS[path] ?? "/admin/login";

  useEffect(() => {
    window.location.replace(`https://lipwatasks.site${destination}`);
  }, [destination]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">Opening Lipwa Tasks admin…</p>
    </main>
  );
}
