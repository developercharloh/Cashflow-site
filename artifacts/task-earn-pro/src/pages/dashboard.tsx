import { useAuth } from "@/hooks/use-auth";
import {
  useGetDashboardStats,
  useGetRecentActivity,
  useDailyCheckIn,
  useGetTasks,
  useGetReferralInfo,
  useGetLeaderboard,
  useGetNotifications,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Play, FileText, ClipboardList, Cpu,
  Wallet, Users, ArrowUpRight, TrendingUp,
  CheckCircle2, Gift, Star, ChevronRight,
  Crown, CalendarCheck, Bell, CircleDollarSign,
  Clock, Award,
} from "lucide-react";

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? "s" : ""} ago`;
  return "Yesterday";
}

function categoryIcon(cat: string) {
  const c = cat?.toLowerCase() ?? "";
  if (c === "video") return <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Play className="w-4 h-4 text-purple-600" /></div>;
  if (c === "reading") return <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><FileText className="w-4 h-4 text-orange-500" /></div>;
  if (c === "survey") return <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-yellow-600" /></div>;
  if (c === "ai training") return <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Cpu className="w-4 h-4 text-green-600" /></div>;
  return <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Star className="w-4 h-4 text-blue-600" /></div>;
}

function difficultyBadge(diff: string) {
  const d = diff?.toLowerCase() ?? "";
  const cls =
    d === "easy" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    d === "medium" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{diff}</span>;
}

function activityIcon(type: string) {
  if (type === "task_completed") return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>;
  if (type === "referral") return <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Gift className="w-4 h-4 text-blue-600" /></div>;
  if (type === "level_up") return <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-purple-600" /></div>;
  if (type === "check_in") return <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><CalendarCheck className="w-4 h-4 text-yellow-600" /></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><CircleDollarSign className="w-4 h-4 text-muted-foreground" /></div>;
}

function SparkLine() {
  const pts = [50,45,60,40,70,55,80,65,90,75,85,95,70];
  const max = Math.max(...pts), min = Math.min(...pts);
  const w = 200, h = 50;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
      <text x="160" y="14" fontSize="11" fill="#6b7280">1.08945</text>
      <line x1="155" y1="18" x2="200" y2="18" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="3" />
    </svg>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats, refetch: refetchStats } = useGetDashboardStats();
  const { data: activity } = useGetRecentActivity();
  const { data: tasks } = useGetTasks();
  const { data: referralInfo } = useGetReferralInfo();
  const { data: leaderboard } = useGetLeaderboard({ period: "weekly" });
  const { data: notifications } = useGetNotifications();
  const checkInMutation = useDailyCheckIn();

  const firstName = user?.name?.split(" ")[0] ?? "User";
  const balance = stats?.balance ?? 0;
  const pending = stats?.pendingEarnings ?? 0;
  const totalEarned = balance + (stats?.totalWithdrawn ?? 0);
  const levelProgress = stats?.levelProgress ?? 0;
  const nextLevel = (stats?.level ?? 1) + 1;
  const levelName = stats?.levelName ?? "Explorer";

  const handleCheckIn = () => {
    checkInMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Daily Check-in! 🎉", description: `You earned ${formatMoney(res.rewardEarned)}. Streak: ${res.streakDays} days!` });
        refetchStats();
      },
      onError: (err) => toast({ title: "Already checked in", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="pb-4">
      {/* Welcome */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Hi, {firstName}! 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Complete tasks, earn points and withdraw real money.</p>
      </div>

      {/* Premium Banner */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Upgrade to Premium</p>
              <p className="text-white/70 text-xs">Unlock high paying tasks and more benefits.</p>
            </div>
          </div>
          <Link href="/membership">
            <button className="bg-white text-violet-700 font-bold text-xs px-3 py-2 rounded-xl shrink-0">
              Upgrade Now
            </button>
          </Link>
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        {/* Balance */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Available Balance</p>
            <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-green-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-green-600">{formatMoney(balance)}</p>
          <p className="text-[9px] text-green-500 mt-1 flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> Withdrawable
          </p>
        </div>

        {/* Pending */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Pending Earnings</p>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-blue-600">{formatMoney(pending)}</p>
          <p className="text-[9px] text-blue-400 mt-1">Processing</p>
        </div>

        {/* Total Earned */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Total Earned</p>
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-purple-600">{formatMoney(totalEarned)}</p>
          <p className="text-[9px] text-muted-foreground mt-1">All time</p>
        </div>
      </div>

      {/* Progress Card */}
      <div className="mx-4 mb-4 rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold opacity-80">Your Progress</p>
          <div className="flex items-center gap-1">
            <p className="text-xs opacity-60">Progress to Level {nextLevel}</p>
            <p className="text-xs font-bold text-green-400">{levelProgress}%</p>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Level {stats?.level ?? 1}: {levelName}</p>
            <p className="text-xs opacity-60 mt-0.5">Complete more tasks to unlock high paying opportunities.</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-white/10 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${levelProgress}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <Link href="/membership">
            <button className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/20 transition-colors">
              View All Levels
            </button>
          </Link>
          <div className="flex gap-4 text-xs">
            <div className="text-center">
              <p className="font-bold text-white">{stats?.tasksCompleted ?? 0}<span className="text-white/40">/{(stats?.tasksCompleted ?? 0) + (stats?.tasksAvailable ?? 0)}</span></p>
              <p className="text-white/50 text-[9px] mt-0.5">Tasks Done</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-white">{stats?.streakDays ?? 0}<span className="text-white/40"> days</span></p>
              <p className="text-white/50 text-[9px] mt-0.5">Active Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Balance Card */}
      <div className="mx-4 mb-4 rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold opacity-70">Wallet Balance</p>
          <p className="text-xs opacity-50">USD</p>
        </div>
        <p className="text-3xl font-bold mb-0.5">{formatMoney(balance)}</p>
        <p className="text-xs opacity-50 mb-4">Available to withdraw</p>

        <Link href="/wallet">
          <button className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 mb-4 transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #16a34a, #22c55e)" }}>
            <span>Withdraw Money</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>

        <div className="flex items-center justify-around">
          {[
            { label: "M-Pesa", color: "#00a651", letter: "M" },
            { label: "Airtel", color: "#e4002b", letter: "A" },
            { label: "Bank", color: "#2563eb", icon: <Wallet className="w-4 h-4 text-white" /> },
            { label: "PayPal", color: "#003087", letter: "P" },
            { label: "More", color: "#374151", icon: <span className="text-white text-lg font-bold">···</span> },
          ].map(({ label, color, letter, icon }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color }}>
                {icon ?? <span className="text-white text-sm font-bold">{letter}</span>}
              </div>
              <span className="text-[9px] text-white/60">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks + Binary Trading */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-4">
        {/* Available Tasks */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold">Available Tasks</p>
            <Link href="/tasks"><span className="text-[10px] text-primary font-semibold">View all</span></Link>
          </div>
          <div className="space-y-2.5">
            {(tasks ?? []).slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <div className="shrink-0">{categoryIcon(task.category)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate">{task.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {difficultyBadge(task.difficulty)}
                    <span className="text-[9px] text-muted-foreground truncate">{task.category}</span>
                  </div>
                </div>
              </div>
            ))}
            {(tasks ?? []).length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">No tasks available</p>
            )}
          </div>
          <Link href="/tasks">
            <button className="w-full mt-3 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-bold">
              Start Task
            </button>
          </Link>
        </div>

        {/* Binary Trading */}
        <div className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold">Binary Trading</p>
            <span className="text-[9px] bg-violet-500 px-1.5 py-0.5 rounded-md font-bold">New</span>
          </div>
          <div className="mb-2">
            <p className="text-[9px] opacity-60">Practice Account</p>
            <p className="text-sm font-bold">$1,000.00</p>
          </div>
          <div className="mb-2">
            <p className="text-[9px] opacity-60">Today's P&L</p>
            <p className="text-sm font-bold text-green-400">+$45.60</p>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded-md">EUR/USD</span>
            <span className="text-[9px] opacity-60">1 min</span>
          </div>
          <SparkLine />
          <div className="grid grid-cols-2 gap-1 mt-2">
            <button className="py-1.5 rounded-lg text-white text-[9px] font-bold" style={{ background: "#16a34a" }}>
              UP 80%
            </button>
            <button className="py-1.5 rounded-lg text-white text-[9px] font-bold" style={{ background: "#dc2626" }}>
              DOWN 80%
            </button>
          </div>
          <Link href="/leaderboard">
            <p className="text-[9px] text-violet-300 mt-2 text-center">Go to Binary Trading →</p>
          </Link>
        </div>
      </div>

      {/* Referrals + Recent Activity */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-4">
        {/* Referral Overview */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold">Referral Overview</p>
            <Link href="/referrals"><span className="text-[10px] text-primary font-semibold">View all</span></Link>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-base font-bold">{referralInfo?.totalReferrals ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">Total Referrals</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Active Referrals</p>
              <p className="text-[10px] font-bold">{referralInfo?.activeReferrals ?? 0}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Referral Earnings</p>
              <p className="text-[10px] font-bold text-green-600">{formatMoney(referralInfo?.totalEarned ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold">Recent Activity</p>
            <Link href="/wallet"><span className="text-[10px] text-primary font-semibold">View all</span></Link>
          </div>
          <div className="space-y-2">
            {(activity ?? []).slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="shrink-0">{activityIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate leading-tight">{item.description}</p>
                  <p className="text-[9px] text-muted-foreground">{timeAgo(item.createdAt)}</p>
                </div>
                {item.amount && item.amount > 0 && (
                  <span className="text-[10px] font-bold text-green-600 shrink-0">+{formatMoney(item.amount)}</span>
                )}
              </div>
            ))}
            {(activity ?? []).length === 0 && (
              <div className="text-center py-4">
                <p className="text-[10px] text-muted-foreground">No activity yet</p>
                <p className="text-[9px] text-muted-foreground">Complete tasks to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold">Leaderboard <span className="text-muted-foreground font-normal text-xs">(This Week)</span></p>
          <Link href="/leaderboard"><span className="text-xs text-primary font-semibold">View all</span></Link>
        </div>
        {(leaderboard ?? []).length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {[leaderboard![0], leaderboard![1], leaderboard![2]].filter(Boolean).map((entry, idx) => {
              const isFirst = idx === 1;
              return (
                <div key={entry.userId} className={`flex flex-col items-center gap-1.5 ${isFirst ? "order-2" : idx === 0 ? "order-1" : "order-3"}`}>
                  <div className="relative">
                    <div className={`rounded-full flex items-center justify-center font-bold text-white ${isFirst ? "w-14 h-14 text-lg" : "w-11 h-11 text-sm"}`}
                      style={{ background: isFirst ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                    {isFirst && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Crown className="w-4 h-4 text-yellow-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-center truncate w-full">{entry.name.split(" ")[0]}</p>
                  <p className="text-[10px] font-bold text-primary">{Math.round(entry.value).toLocaleString()} pts</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-xs">No leaderboard data yet</p>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Notifications</p>
          <Link href="/notifications"><span className="text-xs text-primary font-semibold">View all</span></Link>
        </div>
        <div className="space-y-3">
          {(notifications ?? []).slice(0, 2).map((notif) => (
            <div key={notif.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-snug">{notif.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{notif.message}</p>
              </div>
            </div>
          ))}
          {(notifications ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No notifications</p>
          )}
        </div>
        <Link href="/notifications">
          <button className="w-full mt-3 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground flex items-center justify-center gap-1 hover:bg-muted transition-colors">
            View All Notifications <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>

      {/* Daily Check-in Sticky Bar */}
      <div className="mx-4 mb-2 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(90deg, #1e3a5f 0%, #0f172a 100%)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">Daily Check-in</p>
              <p className="text-white/50 text-[10px]">daily and earn bonuses!</p>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending}
            className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors disabled:opacity-60"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check In
          </button>
        </div>
      </div>
    </div>
  );
}
