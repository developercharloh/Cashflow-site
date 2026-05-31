import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardStats, useGetRecentActivity, useDailyCheckIn } from "@workspace/api-client-react";
import { Loader2, TrendingUp, CheckCircle, Wallet, Award, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const checkInMutation = useDailyCheckIn();

  const handleCheckIn = () => {
    checkInMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({
          title: "Daily Check-in Complete!",
          description: `You earned $${res.rewardEarned.toFixed(2)}. Streak: ${res.streakDays} days!`,
        });
        refetchStats();
      },
      onError: (err) => {
        toast({
          title: "Check-in failed",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}. Here's what's happening today.</p>
        </div>
        <Button onClick={handleCheckIn} disabled={checkInMutation.isPending} className="bg-success hover:bg-success/90 text-success-foreground">
          {checkInMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
          Claim Daily Reward
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            <Wallet className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">${stats.balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +${stats.pendingEarnings.toFixed(2)} pending
            </p>
          </CardContent>
        </Card>

        <Card className="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.tasksAvailable} available now
            </p>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-warning/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Level</CardTitle>
            <Award className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{stats.levelName}</div>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={stats.levelProgress} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.levelProgress}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Streak</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.streakDays} Days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Keep it up for bonus multipliers
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 glassmorphism">
          <CardHeader>
            <CardTitle>Earning Potential</CardTitle>
            <CardDescription>Tasks recommended for your level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Ready to earn?</h3>
              <p className="text-muted-foreground max-w-sm mb-6">There are {stats.tasksAvailable} tasks waiting for you in the marketplace. Complete them to boost your level.</p>
              <Button asChild>
                <Link href="/tasks">Browse Tasks <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-6">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 z-10">
                      {item.type === 'task_completed' && <CheckCircle className="w-4 h-4 text-success" />}
                      {item.type === 'withdrawal' && <Wallet className="w-4 h-4 text-primary" />}
                      {item.type === 'check_in' && <Award className="w-4 h-4 text-warning" />}
                      {item.type === 'referral' && <Users className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {item.amount && (
                      <div className={`text-sm font-bold pt-1 ${item.amount > 0 ? 'text-success' : ''}`}>
                        {item.amount > 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// We need Target and Users imported
import { Target, Users } from "lucide-react";
