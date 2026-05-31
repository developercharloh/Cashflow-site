import { useAdminGetAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(217,91%,60%)", "hsl(160,84%,39%)", "hsl(43,96%,56%)", "hsl(0,84%,60%)"];

export default function AdminAnalytics() {
  const { data: analytics, isLoading } = useAdminGetAnalytics();

  if (isLoading || !analytics) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const userBreakdown = [
    { name: "Active Users", value: analytics.activeUsers },
    { name: "Inactive Users", value: analytics.totalUsers - analytics.activeUsers },
  ];

  const withdrawalBreakdown = [
    { name: "Completed", value: analytics.totalWithdrawals - analytics.pendingWithdrawals },
    { name: "Pending", value: analytics.pendingWithdrawals },
  ];

  const mockMonthlyData = Array.from({ length: 6 }, (_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i],
    revenue: Math.round(analytics.revenueThisMonth * (0.4 + Math.random() * 0.8)),
    users: Math.round(analytics.newUsersThisMonth * (0.6 + Math.random() * 0.9)),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">Revenue and growth metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `$${analytics.totalEarningsPaid.toFixed(2)}` },
          { label: "This Month", value: `$${analytics.revenueThisMonth.toFixed(2)}` },
          { label: "Tasks Completed", value: analytics.totalTasksCompleted },
          { label: "Total Users", value: analytics.totalUsers },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="text-xs text-muted-foreground mb-2">{label}</div>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader><CardTitle>Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle>User Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="users" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle>User Status</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-6">
            <PieChart width={140} height={140}>
              <Pie data={userBreakdown} cx={65} cy={65} innerRadius={45} outerRadius={65} dataKey="value">
                {userBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {userBreakdown.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle>Withdrawal Status</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-6">
            <PieChart width={140} height={140}>
              <Pie data={withdrawalBreakdown} cx={65} cy={65} innerRadius={45} outerRadius={65} dataKey="value">
                {withdrawalBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i + 1]} />)}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {withdrawalBreakdown.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i + 1] }} />
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
