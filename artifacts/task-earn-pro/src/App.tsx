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
import Terms from "@/pages/terms";
import GamesPage from "@/pages/games";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import WalletPage from "@/pages/wallet";
import Referrals from "@/pages/referrals";
import Membership from "@/pages/membership";
import Notifications from "@/pages/notifications";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminTasks from "@/pages/admin/tasks";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminAnalytics from "@/pages/admin/analytics";
import BinaryTradingPage from "@/pages/binary-trading";
import CallbackPage from "@/pages/callback";
import ProfilePage from "@/pages/profile";
import KycPage from "@/pages/kyc";
import AdminKycPage from "@/pages/admin/kyc";

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


function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={RedirectToDashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/auth/login" component={Login} />
        <Route path="/auth/register" component={Register} />
        <Route path="/auth/forgot-password" component={ForgotPassword} />
        <Route path="/terms" component={Terms} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/membership" component={Membership} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/tasks" component={AdminTasks} />
        <Route path="/admin/withdrawals" component={AdminWithdrawals} />
        <Route path="/callback" component={CallbackPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/kyc" component={KycPage} />
        <Route path="/admin/kyc" component={AdminKycPage} />
        <Route path="/binary" component={BinaryTradingPage} />
        <Route path="/games" component={GamesPage} />
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
