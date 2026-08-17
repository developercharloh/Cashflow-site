import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ForgotPassword from "@/pages/auth/forgot-password";
import Terms from "@/pages/terms";
import TradingHome from "@/pages/trading/home";
import MarketsPage from "@/pages/trading/markets";
import SignalDetailPage from "@/pages/trading/signal-detail";
import SignalsPage from "@/pages/trading/signals";
import AnalyticsPage from "@/pages/trading/analytics";
import HistoryPage from "@/pages/trading/history";
import SettingsPage from "@/pages/trading/settings";
import BinaryTradingPage from "@/pages/binary-trading";
import ProfilePage from "@/pages/profile";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminTasks from "@/pages/admin/tasks";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminKycPage from "@/pages/admin/kyc";
import CallbackPage from "@/pages/callback";
import WalletPage from "@/pages/wallet";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/dashboard"); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"                    component={RedirectToDashboard} />
        <Route path="/dashboard"           component={TradingHome} />
        <Route path="/markets"             component={MarketsPage} />
        <Route path="/markets/:symbol"     component={SignalDetailPage} />
        <Route path="/signals"             component={SignalsPage} />
        <Route path="/analytics"           component={AnalyticsPage} />
        <Route path="/history"             component={HistoryPage} />
        <Route path="/wallet"              component={WalletPage} />
        <Route path="/settings"            component={SettingsPage} />
        <Route path="/binary"              component={BinaryTradingPage} />
        <Route path="/auth/login"          component={Login} />
        <Route path="/auth/register"       component={Register} />
        <Route path="/auth/forgot-password" component={ForgotPassword} />
        <Route path="/terms"               component={Terms} />
        <Route path="/profile"             component={ProfilePage} />
        <Route path="/admin"               component={AdminDashboard} />
        <Route path="/admin/users"         component={AdminUsers} />
        <Route path="/admin/tasks"         component={AdminTasks} />
        <Route path="/admin/withdrawals"   component={AdminWithdrawals} />
        <Route path="/admin/analytics"     component={AdminAnalytics} />
        <Route path="/admin/kyc"           component={AdminKycPage} />
        <Route path="/callback"            component={CallbackPage} />
        <Route                             component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
