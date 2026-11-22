import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, Search, Wallet, Landmark, CandlestickChart } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",       icon: Home },
  { href: "/tasks",     label: "Work",       icon: Search },
  { href: "/wallet",    label: "Wallet",   icon: Wallet },
  { href: "/loans",     label: "Soft Loans", icon: Landmark },
  { href: "/forex",     label: "Forex",      icon: CandlestickChart },
];

function BottomNav() {
  const [location] = useLocation();
  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Worker navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md"
    >
      <div className="mx-auto flex h-[68px] max-w-xl items-center justify-around px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            location === href ||
            (href === "/tasks" && location.startsWith("/tasks"));
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function RedirectToLogin() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/auth/login"); }, [setLocation]);
  return null;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full bg-background px-5 py-8" aria-label="Loading your workspace">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-12 w-2/3 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2"><div className="h-36 animate-pulse rounded-2xl bg-muted" /><div className="h-36 animate-pulse rounded-2xl bg-muted" /></div>
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const isAuthPage   = location.startsWith("/auth");
  const isPublicPage = isAuthPage || location === "/terms" || location === "/";

  if (isPublicPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!user) return <RedirectToLogin />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-7">
          <Link
            href="/dashboard"
            data-testid="link-app-brand"
            aria-label="Lipwa Tasks home"
            className="flex items-center gap-2.5"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground">
              L
            </span>
            <span className="font-semibold tracking-tight">Lipwa Tasks</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
