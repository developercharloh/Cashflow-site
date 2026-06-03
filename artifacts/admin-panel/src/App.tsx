import { Route, Switch, Redirect } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/auth";
import Layout from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Tasks from "@/pages/tasks";
import Withdrawals from "@/pages/withdrawals";
import KYC from "@/pages/kyc";
import Activity from "@/pages/activity";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400 text-sm">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {user ? <Protected><Dashboard /></Protected> : <Redirect to="/login" />}
      </Route>
      <Route path="/users">
        <Protected><Users /></Protected>
      </Route>
      <Route path="/tasks">
        <Protected><Tasks /></Protected>
      </Route>
      <Route path="/withdrawals">
        <Protected><Withdrawals /></Protected>
      </Route>
      <Route path="/kyc">
        <Protected><KYC /></Protected>
      </Route>
      <Route path="/activity">
        <Protected><Activity /></Protected>
      </Route>
      <Route><Redirect to="/" /></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
