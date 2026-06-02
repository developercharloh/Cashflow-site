import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import {
  Bell, Moon, Sun, Home, CheckSquare, TrendingUp,
  Wallet, Users, MoreHorizontal, ChevronDown, Search, Settings, BarChart2
} from "lucide-react";
import { useLogout, useGetNotifications, getGetNotificationsQueryOptions } from "@workspace/api-client-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/binary", label: "Binary", icon: BarChart2 },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/notifications", label: "More", icon: MoreHorizontal },
];

function TopHeader() {
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications } = useGetNotifications({
    query: { ...getGetNotificationsQueryOptions(), enabled: !!user },
  });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const handleLogout = () => {
    setMenuOpen(false);
    logoutMutation.mutate(undefined, { onSuccess: logout });
  };

  const effectiveTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : theme;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-3 gap-2">
      <div className="flex-1 bg-muted rounded-full flex items-center px-3 py-1.5 gap-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate">Search tasks, users, categories...</span>
      </div>

      <Link href="/notifications" className="relative p-1.5 shrink-0">
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>

      <button
        className="p-1.5 shrink-0 text-muted-foreground"
        onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}
      >
        {effectiveTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="relative shrink-0">
        <button className="flex items-center gap-1.5" onClick={() => setMenuOpen((o) => !o)}>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <span className="text-sm font-semibold hidden sm:block max-w-[80px] truncate">
            {user?.name ?? "User"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-border rounded-xl shadow-xl py-1 z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.levelName ?? "Explorer"}</p>
            </div>
            {user?.isAdmin && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                onClick={() => { setMenuOpen(false); setLocation("/admin"); }}
              >
                <Settings className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <button
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            location === href ||
            (href === "/dashboard" && (location === "/" || location === "/dashboard"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1 flex-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
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
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthPage = location.startsWith("/auth");

  if (isAuthPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!user) {
    // Redirect unauthenticated users to login
    return <RedirectToLogin />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopHeader />
      <main className="pt-14 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
