import { useState, useEffect, useCallback } from "react";
import { useGetTasks, useGetTaskCategories, useStartTask, useCompleteTask, getGetTasksQueryKey, getGetDashboardStatsQueryKey, useInitializeUpgrade, useBuyTranscriptionMinutes, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Clock, DollarSign, Zap, CheckCircle, Loader2, BarChart2, BookOpen, Video, MessageCircle, Brain, Database, Calendar, Mic, Timer, AlertCircle, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Surveys": <BarChart2 className="w-4 h-4" />,
  "Video Watching": <Video className="w-4 h-4" />,
  "Article Reading": <BookOpen className="w-4 h-4" />,
  "Digital Engagement Tasks": <MessageCircle className="w-4 h-4" />,
  "AI Training Tasks": <Brain className="w-4 h-4" />,
  "Data Categorization": <Database className="w-4 h-4" />,
  "Daily Check-In Tasks": <Calendar className="w-4 h-4" />,
  "Transcription Tasks": <Mic className="w-4 h-4" />,
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   "bg-green-500/10 text-green-500 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  hard:   "bg-red-500/10 text-red-500 border-red-500/20",
};

const MINUTE_BUNDLES = [
  { key: "starter",  label: "10 minutes",  price: "$2",  minutes: 10 },
  { key: "basic",    label: "30 minutes",  price: "$5",  minutes: 30 },
  { key: "standard", label: "60 minutes",  price: "$9",  minutes: 60 },
  { key: "premium",  label: "120 minutes", price: "$15", minutes: 120 },
];

function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / seconds) * 100;
  const urgent = remaining < 60;

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-bold tabular-nums ${urgent ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
      <Timer className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{mins}:{String(secs).padStart(2, "0")}</span>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${urgent ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BuyMinutesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const buyMutation = useBuyTranscriptionMinutes();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (pkg: string) => {
    setLoading(pkg);
    buyMutation.mutate({ data: { package: pkg } }, {
      onSuccess: (res) => {
        if (res.authorizationUrl) {
          window.open(res.authorizationUrl, "_blank");
          toast({ title: "Payment Page Opened", description: "Complete payment in the new tab. Come back after payment to use your minutes." });
        }
        onClose();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
      onSettled: () => setLoading(null),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Buy Transcription Minutes
          </DialogTitle>
          <DialogDescription>
            Purchase minutes to unlock and complete transcription tasks. Minutes don't expire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {MINUTE_BUNDLES.map(b => (
            <button
              key={b.key}
              onClick={() => handleBuy(b.key)}
              disabled={!!loading}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
            >
              <div>
                <p className="font-semibold text-sm">{b.label}</p>
                <p className="text-xs text-muted-foreground">Pay via Paystack</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-green-500">{b.price}</span>
                {loading === b.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, userMinutes, onComplete, onBuyMinutes }: {
  task: any;
  userMinutes: number;
  onComplete: () => void;
  onBuyMinutes: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const startMutation = useStartTask();
  const completeMutation = useCompleteTask();
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const isTranscription = task.taskType === "transcription";
  const needsMinutes = isTranscription && (userMinutes < (task.minutesCost ?? 0));

  const handleExpire = useCallback(() => {
    setExpired(true);
    setStarted(false);
    toast({ title: "Time's Up!", description: "The task timer has expired. You can restart it.", variant: "destructive" });
  }, [toast]);

  const handleStart = () => {
    if (needsMinutes) { onBuyMinutes(); return; }
    startMutation.mutate({ id: task.id }, {
      onSuccess: (res: any) => {
        setStarted(true);
        setExpired(false);
        if (res.timeLimitSeconds) setTimeLeft(res.timeLimitSeconds);
        else if (task.timeLimitSeconds) setTimeLeft(task.timeLimitSeconds);
        setShowInstructions(true);
      },
      onError: (err: any) => {
        if (err.requiresMinutes) { onBuyMinutes(); return; }
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleComplete = () => {
    if (expired) {
      toast({ title: "Time Expired", description: "Please restart the task.", variant: "destructive" });
      return;
    }
    completeMutation.mutate({ id: task.id, data: {} }, {
      onSuccess: (res) => {
        toast({ title: "Task Completed! 🎉", description: res.message });
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setStarted(false);
        setTimeLeft(null);
        onComplete();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message ?? "Failed to complete task", variant: "destructive" });
      }
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`border h-full flex flex-col transition-all ${
          task.completedByUser ? "opacity-60 border-border" :
          started ? "border-primary/50 shadow-[0_0_12px_rgba(var(--color-primary)/0.15)]" :
          "hover:border-primary/30 border-border"
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {CATEGORY_ICONS[task.category] ?? <Zap className="w-4 h-4" />}
                <span>{task.category}</span>
              </div>
              <div className="flex items-center gap-2">
                {isTranscription && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                    <Mic className="w-2.5 h-2.5 mr-1" />Transcription
                  </Badge>
                )}
                {task.completedByUser && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </div>
            </div>
            <CardTitle className="text-base leading-snug mt-1">{task.title}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col justify-end gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[task.difficulty] ?? DIFFICULTY_COLOR.easy}`}>
                {task.difficulty}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />{task.estimatedMinutes} min
              </span>
              {task.timeLimitSeconds && !started && (
                <span className="flex items-center gap-1 text-xs text-amber-400/70">
                  <Timer className="w-3 h-3" />Timer
                </span>
              )}
              {isTranscription && task.minutesCost && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Mic className="w-3 h-3" />{task.minutesCost} min
                </span>
              )}
            </div>

            {/* Countdown when active */}
            {started && timeLeft !== null && (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  <Countdown seconds={timeLeft} onExpire={handleExpire} />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Transcription: not enough minutes warning */}
            {isTranscription && needsMinutes && !task.completedByUser && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-300">
                  Need {task.minutesCost} min · You have {userMinutes.toFixed(1)} min
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-lg font-bold text-green-500">
                <DollarSign className="w-4 h-4" />{task.reward.toFixed(2)}
              </div>

              {task.completedByUser ? (
                <Badge variant="outline" className="text-green-500 border-green-500/30">Completed</Badge>
              ) : isTranscription && needsMinutes ? (
                <Button size="sm" variant="outline" onClick={onBuyMinutes} className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10">
                  <ShoppingCart className="w-3 h-3 mr-1" />Buy Minutes
                </Button>
              ) : !started ? (
                <Button size="sm" onClick={handleStart} disabled={startMutation.isPending}>
                  {startMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Start</>}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleComplete} disabled={completeMutation.isPending || expired}
                  className={expired ? "opacity-50" : ""}>
                  {completeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 mr-1" />Done</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{task.title}</DialogTitle>
            <DialogDescription>Read the instructions carefully before starting</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {task.timeLimitSeconds && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-300">
                  You have <strong>{Math.floor(task.timeLimitSeconds / 60)} minutes</strong> to complete this task. Timer started!
                </p>
              </div>
            )}
            {task.instructions && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm leading-relaxed">
                {task.instructions}
              </div>
            )}
          </div>
          <Button onClick={() => setShowInstructions(false)} className="w-full">
            Got it, let's go!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("all");
  const [buyMinutesOpen, setBuyMinutesOpen] = useState(false);
  const { data: categories } = useGetTaskCategories();
  const { data: tasks, isLoading, refetch } = useGetTasks(
    activeCategory !== "all" ? { category: activeCategory } : {},
    { query: { queryKey: getGetTasksQueryKey(activeCategory !== "all" ? { category: activeCategory } : {}) } }
  );

  const userMinutes = (user as any)?.transcriptionMinutes ?? 0;
  const allCategories = ["all", ...(categories?.map(c => c.name) ?? [])];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Marketplace</h1>
          <p className="text-muted-foreground mt-1">Complete tasks to earn real money</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 flex-shrink-0">
          <Mic className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">{userMinutes.toFixed(1)} min</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-purple-400 hover:text-purple-300" onClick={() => setBuyMinutesOpen(true)}>
            Buy
          </Button>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex-nowrap w-max gap-1">
            {allCategories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="whitespace-nowrap text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  {cat !== "all" && CATEGORY_ICONS[cat]}
                  {cat === "all" ? "All Tasks" : cat}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeCategory} className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No tasks available in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userMinutes={userMinutes}
                  onComplete={refetch}
                  onBuyMinutes={() => setBuyMinutesOpen(true)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BuyMinutesModal open={buyMinutesOpen} onClose={() => setBuyMinutesOpen(false)} />
    </div>
  );
}
