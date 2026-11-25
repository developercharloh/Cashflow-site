import { Switch, Route, Router as WouterRouter } from "wouter";
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
import ProfilePage from "@/pages/profile";
import KycPage from "@/pages/kyc";
import CallbackPage from "@/pages/callback";
import WalletPage from "@/pages/wallet";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TasksPage from "@/pages/tasks";
import QuizPage from "@/pages/quiz";
import LoansPage from "@/pages/loans";
import ForexPage from "@/pages/forex";
import SupportPage from "@/pages/support";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"                    component={Landing} />
        <Route path="/dashboard"           component={Dashboard} />
        <Route path="/tasks"               component={TasksPage} />
        <Route path="/quiz"                component={QuizPage} />
        <Route path="/wallet"              component={WalletPage} />
        <Route path="/loans"               component={LoansPage} />
        <Route path="/forex"               component={ForexPage} />
        <Route path="/auth/login"          component={Login} />
        <Route path="/auth/register"       component={Register} />
        <Route path="/auth/forgot-password" component={ForgotPassword} />
        <Route path="/terms"               component={Terms} />
        <Route path="/profile"             component={ProfilePage} />
        <Route path="/kyc"                 component={KycPage} />
        <Route path="/support"             component={SupportPage} />
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
