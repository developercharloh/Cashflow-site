import { Route, Switch, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import AdminDashboard from "@/pages/admin/index";
import AdminLoginPage from "@/pages/admin/login";
import AdminUsers from "@/pages/admin/users";
import AdminTasks from "@/pages/admin/tasks";
import AdminTaskBids from "@/pages/admin/task-bids";
import AdminTaskSubmissions from "@/pages/admin/task-submissions";
import AdminAuditLog from "@/pages/admin/audit-log";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminKycPage from "@/pages/admin/kyc";
import AdminSupportPage from "@/pages/support";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function AdminRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen animate-pulse bg-background" aria-label="Loading admin workspace" />;
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          {user?.isAdmin ? <Redirect to="/admin" /> : <Redirect to="/admin/login" />}
        </Route>
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/tasks" component={AdminTasks} />
        <Route path="/admin/task-bids" component={AdminTaskBids} />
        <Route path="/admin/task-submissions" component={AdminTaskSubmissions} />
        <Route path="/admin/audit-log" component={AdminAuditLog} />
        <Route path="/admin/withdrawals" component={AdminWithdrawals} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/kyc" component={AdminKycPage} />
        <Route path="/support" component={AdminSupportPage} />
        <Route>
          {user?.isAdmin ? <Redirect to="/admin" /> : <Redirect to="/admin/login" />}
        </Route>
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  if (
    window.location.hostname.endsWith(".vercel.app") &&
    window.location.hostname !== "taskearn-admin.vercel.app"
  ) {
    const adminUrl = new URL(window.location.href);
    window.location.replace(
      `https://taskearn-admin.vercel.app${adminUrl.pathname}${adminUrl.search}${adminUrl.hash}`,
    );
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AdminRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
