import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminLoginResponse = {
  token?: string;
  user?: { isAdmin?: boolean };
  error?: string;
};

export default function AdminLoginPage() {
  const { user, setToken } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.isAdmin) setLocation("/admin");
  }, [user, setLocation]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({} as AdminLoginResponse)) as AdminLoginResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in. Check your credentials and try again.");
      }
      if (!data.token || data.user?.isAdmin !== true) {
        throw new Error("Admin access could not be verified.");
      }

      setToken(data.token);
      setLocation("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-10 sm:grid sm:place-items-center sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-7 inline-flex items-center gap-3" aria-label="Lipwa Tasks home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-serif text-xl font-semibold text-primary-foreground">L</span>
          <span className="text-lg font-semibold tracking-tight">Lipwa Tasks</span>
        </Link>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to manage Lipwa Tasks.</p>
            </div>
          </div>

          {error && (
            <div role="alert" data-testid="admin-login-error" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="admin-username" className="text-sm font-medium">Username</label>
              <Input
                id="admin-username"
                data-testid="admin-username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your admin username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  id="admin-password"
                  data-testid="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="pr-11"
                />
                <button
                  type="button"
                  data-testid="toggle-admin-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" data-testid="admin-login-submit" disabled={isSubmitting} className="h-11 w-full bg-emerald-700 font-semibold hover:bg-emerald-800">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
              ) : (
                <>Continue to admin <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            This area is for authorized administrators.
          </p>
        </section>
      </div>
    </main>
  );
}
