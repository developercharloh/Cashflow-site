import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetTaskCategories, useGetTasks, useStartTask, useSubmitTask,
  getGetTasksQueryKey, getGetDashboardStatsQueryKey, getGetMeQueryKey,
  useGetTaskHistory, getGetTaskHistoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Brain, Database, FileText, BarChart2, AlignLeft, Star, Tag, ClipboardList,
  Video, ChevronRight, ChevronLeft, Clock, DollarSign, Zap, CheckCircle,
  XCircle, Loader2, Timer, AlertCircle, Lock, Trophy, Target, TrendingUp,
  Users, RefreshCw, Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  "Data Categorization": { icon: <Database className="w-6 h-6" />, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  "Text Annotation":     { icon: <AlignLeft className="w-6 h-6" />, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  "Questionnaires":      { icon: <ClipboardList className="w-6 h-6" />, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  "AI Training Tasks":   { icon: <Brain className="w-6 h-6" />, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  "Sentence Arrangement":{ icon: <FileText className="w-6 h-6" />, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  "Product Review Analysis": { icon: <Star className="w-6 h-6" />, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  "Data Annotation":     { icon: <Tag className="w-6 h-6" />, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  "Surveys":             { icon: <BarChart2 className="w-6 h-6" />, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  "Video Analysis":      { icon: <Video className="w-6 h-6" />, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

const DIFFICULTY_STYLES: Record<string, { badge: string; label: string }> = {
  easy:   { badge: "bg-green-500/15 text-green-400 border-green-500/25", label: "Easy" },
  medium: { badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25", label: "Medium" },
  hard:   { badge: "bg-red-500/15 text-red-400 border-red-500/25", label: "Hard" },
};

// ── Countdown Timer component ─────────────────────────────────────────────────

function CountdownTimer({ totalSeconds, startTime, onExpire }: { totalSeconds: number; startTime: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000)));
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) { expiredRef.current = true; onExpire(); return; }
    const id = setInterval(() => {
      setRemaining(r => {
        const next = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
        if (next <= 0 && !expiredRef.current) { expiredRef.current = true; clearInterval(id); onExpire(); }
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, [totalSeconds, startTime, onExpire, remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / totalSeconds) * 100;
  const urgent = remaining < 60;

  return (
    <div className={`flex items-center gap-2 text-sm font-mono font-bold tabular-nums ${urgent ? "text-red-400" : "text-amber-400"}`}>
      <Timer className={`w-4 h-4 flex-shrink-0 ${urgent ? "animate-pulse" : ""}`} />
      <span>{mins}:{String(secs).padStart(2, "0")}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full transition-all duration-500 ${urgent ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── View types ────────────────────────────────────────────────────────────────

type View = "categories" | "task_list" | "instructions" | "questions" | "result";

interface TaskQuestion { id: string; question: string; options: string[]; difficulty: string; }
interface StartedTask { attemptId: number; timeLimitSeconds: number | null; questions: TaskQuestion[]; task: any; startTime: number; }
interface SubmitResult { passed: boolean; score: number; correctAnswers: number; totalQuestions: number; message: string; rewardEarned: number; newBalance?: number; }

// ── Main Tasks Page ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [startedTask, setStartedTask] = useState<StartedTask | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: categories = [], isLoading: catsLoading } = useGetTaskCategories();
  const taskQueryParams = selectedCategory ? { category: selectedCategory } : {};
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useGetTasks(
    taskQueryParams,
    { query: { queryKey: getGetTasksQueryKey(taskQueryParams), enabled: view === "task_list" && !!selectedCategory } }
  );
  const { data: history = [], isLoading: historyLoading } = useGetTaskHistory(
    { query: { queryKey: getGetTaskHistoryQueryKey(), enabled: showHistory } }
  );

  const startTaskMutation = useStartTask();
  const submitTaskMutation = useSubmitTask();

  const userLevel = user?.level ?? 1;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setView("task_list");
  };

  const handleBack = () => {
    if (view === "task_list") { setView("categories"); setSelectedCategory(null); }
    else if (view === "instructions") { setView("task_list"); setSelectedTask(null); }
    else if (view === "result") { setView("task_list"); setSelectedTask(null); setSubmitResult(null); setStartedTask(null); }
  };

  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    setView("instructions");
  };

  const handleStartTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await startTaskMutation.mutateAsync({ id: selectedTask.id });
      setStartedTask({
        attemptId: res.attemptId,
        timeLimitSeconds: res.timeLimitSeconds ?? null,
        questions: res.questions ?? [],
        task: selectedTask,
        startTime: Date.now(),
      });
      setCurrentQuestion(0);
      setAnswers({});
      setTimedOut(false);
      setView("questions");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to start task";
      toast({ title: "Cannot Start Task", description: msg, variant: "destructive" });
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNextQuestion = () => {
    if (!startedTask) return;
    if (currentQuestion < startedTask.questions.length - 1) {
      setCurrentQuestion(q => q + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) setCurrentQuestion(q => q - 1);
  };

  const handleTimerExpire = useCallback(async () => {
    if (!startedTask || timedOut) return;
    setTimedOut(true);
    try {
      const timeSpent = Math.round((Date.now() - startedTask.startTime) / 1000);
      const answerList = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
      const res = await submitTaskMutation.mutateAsync({
        id: startedTask.task.id,
        data: { attemptId: startedTask.attemptId, answers: answerList, timeSpent },
      });
      setSubmitResult(res as SubmitResult);
    } catch {
      setSubmitResult({ passed: false, score: 0, correctAnswers: 0, totalQuestions: startedTask.questions.length, message: "Time expired. Task failed.", rewardEarned: 0 });
    }
    setView("result");
    qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTasksQueryKey({ category: selectedCategory ?? undefined }) });
  }, [startedTask, timedOut, answers]);

  const handleSubmit = async () => {
    if (!startedTask) return;
    const timeSpent = Math.round((Date.now() - startedTask.startTime) / 1000);
    const answerList = startedTask.questions.map(q => ({ questionId: q.id, answer: answers[q.id] ?? "" }));
    try {
      const res = await submitTaskMutation.mutateAsync({
        id: startedTask.task.id,
        data: { attemptId: startedTask.attemptId, answers: answerList, timeSpent },
      });
      setSubmitResult(res as SubmitResult);
      setView("result");
      qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTasksQueryKey({ category: selectedCategory ?? undefined }) });
      refetchTasks();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Submission failed";
      if (err?.response?.data?.timedOut) {
        setSubmitResult({ passed: false, score: 0, correctAnswers: 0, totalQuestions: startedTask.questions.length, message: msg, rewardEarned: 0 });
        setView("result");
      } else {
        toast({ title: "Submission Error", description: msg, variant: "destructive" });
      }
    }
  };

  const allAnswered = startedTask ? startedTask.questions.every(q => answers[q.id]) : false;

  // ── Render: Categories View ─────────────────────────────────────────────────

  if (view === "categories") {
    return (
      <div className="space-y-8 max-w-6xl mx-auto pb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Task Marketplace</h1>
            <p className="text-muted-foreground mt-1">Complete AI & data tasks to earn real money</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="shrink-0 gap-1.5">
            <Trophy className="w-4 h-4" /> History
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Brain className="w-4 h-4" />, label: "Task Categories", value: "9", color: "text-blue-400" },
            { icon: <DollarSign className="w-4 h-4" />, label: "Max Reward", value: "$0.60", color: "text-green-400" },
            { icon: <Target className="w-4 h-4" />, label: "Available Tasks", value: "40+", color: "text-primary" },
          ].map(s => (
            <Card key={s.label} className="border-border/60 bg-card/60">
              <CardContent className="p-3 flex flex-col gap-1 items-center text-center">
                <span className={s.color}>{s.icon}</span>
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category grid */}
        {catsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat: any) => {
              const meta = CATEGORY_META[cat.name] ?? { icon: <Brain className="w-6 h-6" />, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" };
              const poolLabel = cat.questionPoolSize ? `${cat.questionPoolSize}+ questions` : "";
              return (
                <motion.div key={cat.name} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className={`border ${meta.border} ${meta.bg} hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer group`}
                    onClick={() => handleSelectCategory(cat.name)}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-xl ${meta.bg} border ${meta.border}`}>
                          <span className={meta.color}>{meta.icon}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${meta.border} ${meta.color} bg-transparent`}>
                          {cat.count} tasks
                        </Badge>
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-tight">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{cat.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="w-3 h-3" />
                            <span>Up to <span className="text-green-400 font-semibold">${(cat.maxReward ?? 0).toFixed(2)}</span> per task</span>
                          </div>
                          {poolLabel && <div className="text-[10px] text-muted-foreground">{poolLabel} in pool</div>}
                        </div>
                        <Button size="sm" variant="ghost" className={`${meta.color} hover:${meta.bg} gap-1 text-xs group-hover:translate-x-0.5 transition-transform`}>
                          View All <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* How it works */}
        <Card className="border-border/40 bg-muted/20">
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-400" /> How Tasks Work</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
              {[
                { n: "1", t: "Start Task", d: "Read the instructions, then begin with a countdown timer active." },
                { n: "2", t: "Answer Questions", d: "Work through each question carefully within the allotted time." },
                { n: "3", t: "Earn Your Reward", d: "Complete the task successfully and your reward is credited instantly." },
              ].map(s => (
                <div key={s.n} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                  <div><p className="font-semibold text-foreground">{s.t}</p><p className="mt-0.5 leading-relaxed">{s.d}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Task History</DialogTitle>
              <DialogDescription>Your recent task attempts and results</DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No task attempts yet. Start completing tasks to see your history!</div>
            ) : (
              <div className="space-y-2">
                {history.map((a: any) => (
                  <div key={a.id} className={`p-3 rounded-lg border ${a.status === "passed" ? "border-green-500/20 bg-green-500/5" : "border-border/40 bg-muted/20"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{a.taskTitle}</p>
                        <p className="text-xs text-muted-foreground">{a.taskCategory}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {a.status === "passed" ? (
                          <span className="text-xs font-semibold text-green-400">+${(a.rewardEarned ?? 0).toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.correctAnswers}/{a.totalQuestions} correct</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Render: Task List View ──────────────────────────────────────────────────

  if (view === "task_list" && selectedCategory) {
    const meta = CATEGORY_META[selectedCategory] ?? { icon: <Brain className="w-6 h-6" />, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" };
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <div className={`p-2 rounded-lg ${meta.bg} border ${meta.border}`}>
            <span className={meta.color}>{meta.icon}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{selectedCategory}</h1>
            <p className="text-xs text-muted-foreground">{tasks.length} tasks available</p>
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tasks available in this category right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks.map((task: any) => {
              const diff = DIFFICULTY_STYLES[task.difficulty ?? "easy"];
              const locked = task.minLevel > userLevel;
              const onCooldown = task.onCooldown;
              return (
                <motion.div key={task.id} whileHover={!locked && !onCooldown ? { y: -1 } : {}}>
                  <Card className={`border border-border/60 transition-all ${locked || onCooldown ? "opacity-60" : "hover:border-primary/30 hover:shadow-md hover:shadow-black/10 cursor-pointer"}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-snug">{task.title}</h3>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${diff.badge}`}>{diff.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedMinutes}m</span>
                        <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{task.questionCount ?? 5} questions</span>
                        <span className="flex items-center gap-1 text-green-400 font-semibold"><DollarSign className="w-3 h-3" />${(task.reward ?? 0).toFixed(2)}</span>
                      </div>
                      {locked ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <Lock className="w-3.5 h-3.5" /> Requires higher membership level
                        </div>
                      ) : onCooldown ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 pt-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>On cooldown — {task.cooldownHours}h cooldown after completion</span>
                        </div>
                      ) : (
                        <Button size="sm" className="w-full gap-1.5 mt-1" onClick={() => handleSelectTask(task)}>
                          <Zap className="w-3.5 h-3.5" /> Start Task
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Instructions View ───────────────────────────────────────────────

  if (view === "instructions" && selectedTask) {
    const diff = DIFFICULTY_STYLES[selectedTask.difficulty ?? "easy"];
    const meta = CATEGORY_META[selectedTask.category] ?? { icon: <Brain className="w-6 h-6" />, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" };
    return (
      <div className="max-w-xl mx-auto space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        </div>

        <Card className={`border ${meta.border} ${meta.bg}`}>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedTask.category}</p>
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${diff.badge}`}>{diff.label}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <DollarSign className="w-4 h-4 text-green-400" />, label: "Reward", value: `$${(selectedTask.reward ?? 0).toFixed(2)}` },
                { icon: <Clock className="w-4 h-4 text-amber-400" />, label: "Time Limit", value: selectedTask.timeLimitSeconds ? `${Math.floor(selectedTask.timeLimitSeconds / 60)}m` : "None" },
                { icon: <ClipboardList className="w-4 h-4 text-blue-400" />, label: "Questions", value: String(selectedTask.questionCount ?? 5) },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-muted/40 p-3 text-center space-y-0.5">
                  <div className="flex justify-center">{s.icon}</div>
                  <div className="text-sm font-bold">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Task Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedTask.instructions ?? selectedTask.description}</p>
            </div>

            <Button className="w-full gap-2 py-5 text-base font-semibold" onClick={handleStartTask} disabled={startTaskMutation.isPending}>
              {startTaskMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</> : <><Zap className="w-4 h-4" /> Begin Task</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Questions View ──────────────────────────────────────────────────

  if (view === "questions" && startedTask) {
    const q = startedTask.questions[currentQuestion];
    const totalQ = startedTask.questions.length;
    const answered = !!answers[q.id];
    const isLast = currentQuestion === totalQ - 1;
    const diff = DIFFICULTY_STYLES[q.difficulty ?? "easy"];

    return (
      <div className="max-w-xl mx-auto space-y-4 pb-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{startedTask.task.title}</span>
            {startedTask.timeLimitSeconds && (
              <CountdownTimer
                totalSeconds={startedTask.timeLimitSeconds}
                startTime={startedTask.startTime}
                onExpire={handleTimerExpire}
              />
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question {currentQuestion + 1} of {totalQ}</span>
              <span>{Object.keys(answers).length}/{totalQ} answered</span>
            </div>
            <Progress value={((currentQuestion + 1) / totalQ) * 100} className="h-1.5" />
          </div>

          {/* Question dots */}
          <div className="flex gap-1.5 flex-wrap">
            {startedTask.questions.map((qItem, i) => (
              <button key={qItem.id} onClick={() => setCurrentQuestion(i)}
                className={`w-6 h-6 rounded-full text-[10px] font-bold border transition-all ${
                  i === currentQuestion ? "bg-primary border-primary text-primary-foreground scale-110" :
                  answers[qItem.id] ? "bg-green-500/20 border-green-500/40 text-green-400" :
                  "bg-muted/40 border-border/40 text-muted-foreground"
                }`}>{i + 1}</button>
            ))}
          </div>
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-relaxed flex-1">{q.question}</p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${diff.badge}`}>{diff.label}</Badge>
                </div>

                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    const selected = answers[q.id] === opt;
                    return (
                      <button key={opt} onClick={() => handleAnswer(q.id, opt)}
                        className={`w-full text-left text-sm px-4 py-3 rounded-lg border transition-all ${
                          selected ? "border-primary bg-primary/10 text-primary font-medium" :
                          "border-border/50 hover:border-primary/40 hover:bg-muted/50 text-foreground"
                        }`}>
                        <span className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground"}`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentQuestion > 0 && (
            <Button variant="outline" size="sm" onClick={handlePrevQuestion} className="gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
          )}
          <div className="flex-1" />
          {!isLast ? (
            <Button size="sm" onClick={handleNextQuestion} disabled={!answered} className="gap-1.5">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit}
              disabled={!allAnswered || submitTaskMutation.isPending}
              className={`gap-1.5 ${allAnswered ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}>
              {submitTaskMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit</>}
            </Button>
          )}
        </div>

        {isLast && !allAnswered && (
          <p className="text-xs text-center text-amber-400">
            Answer all {totalQ} questions before submitting ({Object.keys(answers).length}/{totalQ} answered)
          </p>
        )}
      </div>
    );
  }

  // ── Render: Result View ─────────────────────────────────────────────────────

  if (view === "result" && submitResult) {
    const passed = submitResult.passed;
    return (
      <div className="max-w-md mx-auto space-y-6 pb-8 pt-4">
        <AnimatePresence>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
            <Card className={`border-2 ${passed ? "border-green-500/40 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <CardContent className="p-8 text-center space-y-5">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${passed ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  {passed ? <CheckCircle className="w-10 h-10 text-green-400" /> : <XCircle className="w-10 h-10 text-red-400" />}
                </motion.div>

                <div>
                  <h2 className={`text-2xl font-bold ${passed ? "text-green-400" : "text-red-400"}`}>
                    {passed ? "Perfect Score!" : timedOut ? "Time's Up!" : "Task Failed"}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">{submitResult.message}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Score", value: `${submitResult.score}%`, color: passed ? "text-green-400" : "text-red-400" },
                    { label: "Correct", value: `${submitResult.correctAnswers}/${submitResult.totalQuestions}`, color: "text-foreground" },
                    { label: "Earned", value: passed ? `$${(submitResult.rewardEarned ?? 0).toFixed(2)}` : "$0.00", color: passed ? "text-green-400" : "text-muted-foreground" },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-muted/40 p-3 text-center">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {passed ? (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                    <p className="text-sm font-semibold text-green-400 flex items-center justify-center gap-2">
                      <DollarSign className="w-4 h-4" /> ${(submitResult.rewardEarned ?? 0).toFixed(2)} credited to your wallet!
                    </p>
                    {submitResult.newBalance != null && (
                      <p className="text-xs text-muted-foreground mt-1">New balance: ${submitResult.newBalance.toFixed(2)}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-left space-y-1">
                    <p className="text-xs font-semibold text-foreground">Why no reward?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {timedOut ? "The task timer expired before you submitted." : "One or more answers were incorrect. All questions must be answered correctly for a reward."}
                      {" "}Correct answers are not revealed to maintain task integrity.
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={handleBack}>
                    <ChevronLeft className="w-4 h-4" /> More Tasks
                  </Button>
                  {!passed && (
                    <Button className="flex-1 gap-1.5" onClick={() => {
                      setSubmitResult(null); setStartedTask(null);
                      setView("instructions");
                    }}>
                      <RefreshCw className="w-4 h-4" /> Try Again
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
