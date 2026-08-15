import { useAdminGetAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Users, CheckSquare, Wallet2, BarChart3, Loader2, TrendingUp, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useAdminGetAnalytics();

  if (isLoading || !analytics) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const chartData = [
    { name: "Total Users", value: analytics.totalUsers },
    { name: "Active Users", value: analytics.activeUsers },
    { name: "New This Month", value: analytics.newUsersThisMonth },
    { name: "Tasks Done", value: analytics.totalTasksCompleted },
    { name: "Pending Withdrawals", value: analytics.pendingWithdrawals },
  ];

  const tiles = [
    { label: "Total Users", value: analytics.totalUsers, icon: <Users className="w-5 h-5 text-primary" />, link: "/admin/users" },
    { label: "Active Users", value: analytics.activeUsers, icon: <TrendingUp className="w-5 h-5 text-green-500" />, link: "/admin/users" },
    { label: "Tasks Completed", value: analytics.totalTasksCompleted, icon: <CheckSquare className="w-5 h-5 text-blue-400" />, link: "/admin/tasks" },
    { label: "Total Paid Out", value: `$${analytics.totalEarningsPaid.toFixed(2)}`, icon: <Wallet2 className="w-5 h-5 text-yellow-500" />, link: "/admin/withdrawals" },
    { label: "Pending Withdrawals", value: analytics.pendingWithdrawals, icon: <Clock className="w-5 h-5 text-red-400" />, link: "/admin/withdrawals" },
    { label: "Revenue This Month", value: `$${analytics.revenueThisMonth.toFixed(2)}`, icon: <BarChart3 className="w-5 h-5 text-purple-500" />, link: "/admin/analytics" },
    { label: "New Users This Month", value: analytics.newUsersThisMonth, icon: <Users className="w-5 h-5 text-teal-500" />, link: "/admin/users" },
    { label: "Total Withdrawals", value: analytics.totalWithdrawals, icon: <AlertCircle className="w-5 h-5 text-orange-500" />, link: "/admin/withdrawals" },
    { label: "KYC Verifications", value: "Manage", icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />, link: "/admin/kyc" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ label, value, icon, link }, idx) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Link href={link}>
              <Card className="border-border hover:border-primary/30 cursor-pointer transition-colors">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">{icon}</div>
                  </div>
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle>Platform Overview</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Manage Users", href: "/admin/users", icon: <Users className="w-6 h-6 text-primary" /> },
          { label: "Manage Tasks", href: "/admin/tasks", icon: <CheckSquare className="w-6 h-6 text-blue-400" /> },
          { label: "Withdrawals", href: "/admin/withdrawals", icon: <Wallet2 className="w-6 h-6 text-yellow-500" /> },
          { label: "Analytics", href: "/admin/analytics", icon: <BarChart3 className="w-6 h-6 text-purple-500" /> },
        ].map(({ label, href, icon }) => (
          <Link key={label} href={href}>
            <Card className="border-border hover:border-primary/30 cursor-pointer transition-colors text-center">
              <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
                {icon}
                <span className="text-sm font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
