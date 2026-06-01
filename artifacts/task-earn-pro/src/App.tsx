import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ForgotPassword from "@/pages/auth/forgot-password";
import Quiz from "@/pages/quiz";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import WalletPage from "@/pages/wallet";
import Referrals from "@/pages/referrals";
import Leaderboard from "@/pages/leaderboard";
import Membership from "@/pages/membership";
import Notifications from "@/pages/notifications";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminTasks from "@/pages/admin/tasks";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminAnalytics from "@/pages/admin/analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/dashboard"); }, [setLocation]);
  return null;
}

function BinaryTradingPage() {
  return (
    <div className="px-4 pt-4">
      <div className="rounded-2xl p-6 text-white text-center" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
        <div className="text-4xl mb-3">📈</div>
        <h2 className="text-xl font-bold mb-2">Binary Trading</h2>
        <p className="text-white/60 text-sm mb-4">Practice trading with virtual funds and compete for real rewards.</p>
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-xs text-white/50 mb-1">Virtual Balance</p>
          <p className="text-2xl font-bold">$1,000.00</p>
        </div>
        <p className="text-white/40 text-xs">Full trading platform coming soon</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={RedirectToDashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/auth/login" component={Login} />
        <Route path="/auth/register" component={Register} />
        <Route path="/auth/forgot-password" component={ForgotPassword} />
        <Route path="/quiz" component={Quiz} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/binary" component={BinaryTradingPage} />
        <Route path="/membership" component={Membership} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/tasks" component={AdminTasks} />
        <Route path="/admin/withdrawals" component={AdminWithdrawals} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="taskearn-theme">
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
