import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetDashboardStats,
  useGetRecentActivity,
  useDailyCheckIn,
  useGetTasks,
  useGetReferralInfo,
  useGetNotifications,
  useClaimWelcomeGift,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Play, FileText, ClipboardList, Cpu,
  Wallet, Users, ArrowUpRight, TrendingUp,
  CheckCircle2, Gift, Star, ChevronRight,
  Crown, CalendarCheck, Bell, CircleDollarSign,
  Clock, Award, Zap, Copy,
} from "lucide-react";
import { useToast as useToastFn } from "@/hooks/use-toast";

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
  if (c === "video") return <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0"><Play className="w-4 h-4 text-purple-600" /></div>;
  if (c === "reading") return <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-orange-500" /></div>;
  if (c === "survey") return <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4 text-yellow-600" /></div>;
  if (c === "ai training") return <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0"><Cpu className="w-4 h-4 text-green-600" /></div>;
  return <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0"><Star className="w-4 h-4 text-blue-600" /></div>;
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
  if (type === "task_completed") return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>;
  if (type === "referral") return <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0"><Gift className="w-4 h-4 text-blue-600" /></div>;
  if (type === "level_up") return <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-purple-600" /></div>;
  if (type === "check_in") return <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0"><CalendarCheck className="w-4 h-4 text-yellow-600" /></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><CircleDollarSign className="w-4 h-4 text-muted-foreground" /></div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [giftClaimed, setGiftClaimed] = useState(false);
  const claimGiftMutation = useClaimWelcomeGift();

  const showGiftModal = user && !user.welcomeGiftClaimed && !giftClaimed;

  const handleClaimGift = () => {
    claimGiftMutation.mutate(undefined, {
      onSuccess: () => {
        setGiftClaimed(true);
        queryClient.invalidateQueries();
        toast({ title: "🎁 Gift Card Claimed!", description: "$0.10 has been added to your balance." });
      },
      onError: () => setGiftClaimed(true),
    });
  };

  const { data: stats, refetch: refetchStats } = useGetDashboardStats();
  const { data: activity } = useGetRecentActivity();
  const { data: tasks } = useGetTasks();
  const { data: referralInfo } = useGetReferralInfo();
  const { data: notifications } = useGetNotifications();
  const checkInMutation = useDailyCheckIn();

  const firstName = user?.name?.split(" ")[0] ?? "User";
  const balance = stats?.balance ?? 0;
  const pending = stats?.pendingEarnings ?? 0;
  const totalEarned = balance + (stats?.totalWithdrawn ?? 0);
  const levelProgress = stats?.levelProgress ?? 0;
  const nextLevel = (stats?.level ?? 1) + 1;
  const levelName = stats?.levelName ?? "🚀 Starter";
  const referralLink = referralInfo?.referralLink ?? "";

  const handleCheckIn = () => {
    checkInMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Daily Check-in! 🎉", description: `You earned ${formatMoney(res.rewardEarned)}. Streak: ${res.streakDays} days!` });
        refetchStats();
      },
      onError: (err) => toast({ title: "Already checked in", description: err.message, variant: "destructive" }),
    });
  };

  const handleCopyReferral = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink).then(() => {
        toast({ title: "Copied!", description: "Referral link copied to clipboard." });
      });
    }
  };

  return (
    <div className="pb-4">
      {/* Starter Gift Card Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            {/* Card gradient background */}
            <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-widest opacity-80">New Member Reward</span>
              </div>
              <h2 className="text-2xl font-extrabold mt-2">Starter Gift Card</h2>
              <p className="text-4xl font-black mt-1">$0.10</p>
              <p className="text-sm opacity-80 mt-2">One-time bonus for new members only</p>
              {/* Decorative circles */}
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -right-2 top-10 w-16 h-16 rounded-full bg-white/10" />
            </div>
            <div className="bg-card px-6 py-5">
              <p className="text-sm text-muted-foreground mb-4">
                Welcome to TaskEarn Pro! Claim your <strong className="text-foreground">free $0.10 Starter Gift Card</strong> — credited instantly to your balance.
              </p>
              <button
                onClick={handleClaimGift}
                disabled={claimGiftMutation.isPending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base hover:opacity-90 transition disabled:opacity-60"
              >
                {claimGiftMutation.isPending ? "Claiming..." : "🎁 Claim Gift Card"}
              </button>
              <button
                onClick={() => setGiftClaimed(true)}
                className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition"
              >
                Claim later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Hi, {firstName}! 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Complete tasks, earn points and withdraw real money.</p>
      </div>

      {/* Hero Balance Card */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/60 text-xs font-medium">Available Balance</p>
            <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-green-400 font-semibold">Withdrawable</span>
            </div>
          </div>
          <p className="text-4xl font-extrabold text-white mb-4">{formatMoney(balance)}</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[10px] text-white/50 mb-1">Pending Earnings</p>
              <p className="text-base font-bold text-blue-300">{formatMoney(pending)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[10px] text-white/50 mb-1">Total Earned</p>
              <p className="text-base font-bold text-purple-300">{formatMoney(totalEarned)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/wallet" className="flex-1">
              <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                Withdraw
              </button>
            </Link>
            <Link href="/tasks" className="flex-1">
              <button className="w-full py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Earn More
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
              <Award className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Level {stats?.level ?? 1}: {levelName}</p>
              <p className="text-white/60 text-[10px]">Progress to Level {nextLevel}</p>
            </div>
          </div>
          <Link href="/membership">
            <button className="bg-white/20 hover:bg-white/30 border border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
              View Levels
            </button>
          </Link>
        </div>

        <div className="w-full h-2 bg-white/20 rounded-full mb-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${levelProgress}%`, background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>{levelProgress}% complete</span>
          <div className="flex gap-3">
            <span><span className="text-white font-bold">{stats?.tasksCompleted ?? 0}</span> tasks done</span>
            <span><span className="text-white font-bold">{stats?.streakDays ?? 0}</span> day streak</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-4 gap-2 px-4 mb-4">
        <Link href="/tasks" className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <span className="text-[10px] font-semibold text-center text-foreground leading-tight">Tasks</span>
        </Link>
        <Link href="/wallet" className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-[10px] font-semibold text-center text-foreground leading-tight">Wallet</span>
        </Link>
        <Link href="/referrals" className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-[10px] font-semibold text-center text-foreground leading-tight">Referrals</span>
        </Link>
        <Link href="/membership" className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Crown className="w-5 h-5 text-yellow-600" />
          </div>
          <span className="text-[10px] font-semibold text-center text-foreground leading-tight">Premium</span>
        </Link>
      </div>

      {/* Daily Check-in */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(90deg, #065f46 0%, #047857 100%)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">Daily Check-in</p>
              <p className="text-white/60 text-[10px]">Come back every day to earn bonuses!</p>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending}
            className="bg-white text-emerald-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-opacity disabled:opacity-60 shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check In
          </button>
        </div>
      </div>

      {/* Available Tasks (full width) */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold">Available Tasks</p>
            <p className="text-[10px] text-muted-foreground">{stats?.tasksAvailable ?? 0} tasks ready for you</p>
          </div>
          <Link href="/tasks"><span className="text-xs text-primary font-semibold">View all</span></Link>
        </div>
        <div className="space-y-3">
          {(tasks ?? []).slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
              {categoryIcon(task.category)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{task.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {difficultyBadge(task.difficulty)}
                  <span className="text-[10px] text-muted-foreground truncate">{task.category}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-green-600">+{formatMoney(task.reward)}</p>
                <p className="text-[9px] text-muted-foreground">{task.estimatedMinutes}m</p>
              </div>
            </div>
          ))}
          {(tasks ?? []).length === 0 && (
            <div className="text-center py-6">
              <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No tasks available right now</p>
            </div>
          )}
        </div>
        <Link href="/tasks">
          <button className="w-full mt-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            Start Earning Now
          </button>
        </Link>
      </div>

      {/* Refer & Earn Banner */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)" }}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Gift className="w-4 h-4 text-blue-200" />
                <p className="text-white font-bold text-sm">Refer & Earn $1.00</p>
              </div>
              <p className="text-white/70 text-xs">Share your link. Earn $1 for every friend who joins.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-white">{referralInfo?.totalReferrals ?? 0}</p>
              <p className="text-[10px] text-white/60">Referrals</p>
            </div>
          </div>
          {referralLink ? (
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <p className="flex-1 text-[10px] text-white/80 truncate font-mono">{referralLink}</p>
              <button onClick={handleCopyReferral} className="shrink-0 bg-white text-blue-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
          ) : (
            <Link href="/referrals">
              <button className="w-full py-2.5 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4" />
                Get My Referral Link
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Referrals + Recent Activity */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-4">
        {/* Referral Overview */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold">Referrals</p>
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
              <p className="text-[10px] text-muted-foreground">Active</p>
              <p className="text-[10px] font-bold">{referralInfo?.activeReferrals ?? 0}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Earned</p>
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
                {activityIcon(item.type)}
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
                <p className="text-[9px] text-muted-foreground">Complete tasks to start!</p>
              </div>
            )}
          </div>
        </div>
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

      {/* Upgrade to Premium */}
      <div className="mx-4 mb-2 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)" }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Upgrade to Premium</p>
              <p className="text-white/70 text-xs">Unlock high paying tasks & perks.</p>
            </div>
          </div>
          <Link href="/membership">
            <button className="bg-white text-violet-700 font-bold text-xs px-3 py-2 rounded-xl shrink-0">
              Upgrade
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
