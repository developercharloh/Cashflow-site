import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, BarChart2, Zap, Clock, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",     icon: Home },
  { href: "/markets",   label: "Markets",  icon: BarChart2 },
  { href: "/signals",   label: "Signals",  icon: Zap },
  { href: "/history",   label: "History",  icon: Clock },
  { href: "/settings",  label: "Settings", icon: Settings },
];

function BottomNav() {
  const [location] = useLocation();
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            location === href ||
            (href === "/dashboard" && (location === "/" || location === "/dashboard")) ||
            (href === "/markets" && location.startsWith("/markets"));
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              className={`flex flex-col items-center gap-0.5 py-1 flex-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]" : ""}`} />
              <span className="text-[9px] font-semibold leading-none">{label}</span>
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
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthPage   = location.startsWith("/auth");
  const isPublicPage = isAuthPage || location === "/terms";

  if (isPublicPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!user) return <RedirectToLogin />;

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
