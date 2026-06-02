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
import { Clock, DollarSign, Zap, CheckCircle, Loader2, BarChart2, BookOpen, Video, MessageCircle, Brain, Database, Calendar, Mic, Timer, AlertCircle, ShoppingCart, Lock, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
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

// ── Video IDs per task id (cycling) ──────────────────────────────────────────
const VIDEO_IDS = [
  "ZbZSe6N_BXs", // Simon Sinek – Start With Why
  "UF8uR6Z6KLc", // Steve Jobs Stanford
  "8S0FDjFBj8o", // Jeff Bezos on getting things done
  "qp0HIF3SfI4", // Gary Vee hustle
];

// ── Survey questions by slot ──────────────────────────────────────────────────
const SURVEY_BANKS = [
  [
    { q: "How often do you shop online?", opts: ["Daily", "Weekly", "Monthly", "Rarely"] },
    { q: "What influences your purchase decision most?", opts: ["Price", "Reviews", "Brand", "Friends"] },
    { q: "Rate your satisfaction with online shopping (1–5)", opts: ["1 – Very Poor", "2 – Poor", "3 – Neutral", "4 – Good", "5 – Excellent"] },
    { q: "Which device do you use most for shopping?", opts: ["Smartphone", "Laptop", "Tablet", "Desktop"] },
    { q: "Would you recommend online shopping to others?", opts: ["Definitely Yes", "Probably Yes", "Not Sure", "No"] },
  ],
  [
    { q: "How satisfied are you with local delivery services?", opts: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"] },
    { q: "What is your preferred payment method?", opts: ["M-Pesa", "Debit Card", "PayPal", "Cash on Delivery"] },
    { q: "How do you discover new products?", opts: ["Social Media", "Search Engines", "Friends", "TV Ads"] },
    { q: "How much do you spend online monthly?", opts: ["Under $20", "$20–$50", "$50–$100", "Over $100"] },
    { q: "How important is free delivery to you?", opts: ["Very Important", "Important", "Somewhat", "Not Important"] },
  ],
];

// ── Article content ────────────────────────────────────────────────────────────
const ARTICLES = [
  {
    title: "5 Proven Ways to Grow Your Income in 2025",
    body: `In today's digital economy, growing your income no longer requires a second job or a fancy degree. Millions of people worldwide are earning extra cash through online micro-tasks, freelancing, and passive income strategies.

**1. Complete Online Tasks & Surveys**
Platforms like TaskEarn Pro pay real money for surveys, video watching, and data labeling. These tasks take 5–15 minutes each and can add up quickly — many users earn $50–$200 per month in their spare time.

**2. Sell Digital Products**
E-books, templates, and online courses can be created once and sold repeatedly. A well-designed Canva template can earn passive income for years.

**3. Referral Programs**
Refer friends to services you already use. Many platforms pay $1–$50 per referral, and the earnings compound as your network grows.

**4. Freelance Your Skills**
Platforms like Upwork and Fiverr connect you to clients globally. Even basic skills like data entry, writing, or social media management are in demand.

**5. Invest in Yourself**
Upgrading your skills with free or low-cost courses (Coursera, Khan Academy) directly translates to higher-paying opportunities both online and offline.

The key is consistency. Set aside 30 minutes a day, pick one strategy, and stick with it for 90 days. The results will compound.`,
  },
  {
    title: "How to Stay Healthy While Working From Home",
    body: `Remote work offers flexibility, but it comes with hidden health risks — from sedentary habits to digital eye strain. Here's how to stay healthy while earning from home.

**Set a Consistent Schedule**
Your body thrives on routine. Wake up, eat, and sleep at consistent times even when you work from home. This regulates your circadian rhythm and improves energy levels throughout the day.

**Take Active Breaks**
Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds. Stand up and walk for 2–3 minutes every hour. Even a short stretch reduces back pain and improves circulation.

**Eat Intentionally**
When the kitchen is steps away, mindless snacking becomes a real challenge. Prepare healthy meals in advance and eat at a designated spot — not your workstation.

**Create a Dedicated Workspace**
Having a separate work area signals to your brain that it's "work time." When you leave that space, you mentally clock out — a crucial boundary for mental health.

**Stay Connected**
Social isolation is a real risk of remote work. Schedule regular video calls with colleagues, join online communities, and make time for face-to-face interactions outside work.

Working from home can be a path to better health when managed intentionally. Start with one change today.`,
  },
];

// ── AI Training items ─────────────────────────────────────────────────────────
const AI_ITEMS = [
  { img: "https://picsum.photos/seed/cat1/200/150", question: "Does this image contain a person?", options: ["Yes", "No", "Uncertain"] },
  { img: "https://picsum.photos/seed/dog2/200/150", question: "Is this image suitable for a children's website?", options: ["Yes", "No", "Uncertain"] },
  { img: "https://picsum.photos/seed/nature3/200/150", question: "What best describes this image?", options: ["Outdoors / Nature", "Urban / City", "Indoor", "Abstract"] },
  { img: "https://picsum.photos/seed/food4/200/150", question: "Is this image high quality (well-lit, in-focus)?", options: ["Yes", "No", "Borderline"] },
];

const DATA_ITEMS = [
  { text: "Apple MacBook Pro 16-inch laptop computer", options: ["Electronics", "Clothing", "Food & Beverage", "Sports"] },
  { text: "Running shoes for marathon training", options: ["Electronics", "Clothing", "Food & Beverage", "Sports"] },
  { text: "Organic green tea extract supplement", options: ["Electronics", "Clothing", "Food & Beverage", "Health & Wellness"] },
  { text: "Wireless noise-cancelling headphones", options: ["Electronics", "Clothing", "Food & Beverage", "Sports"] },
  { text: "Men's slim fit cotton t-shirt", options: ["Electronics", "Clothing", "Food & Beverage", "Sports"] },
];

const ENGAGEMENT_STEPS = [
  { action: "Follow the official account", platform: "Twitter / X", link: "https://twitter.com", buttonLabel: "Open Twitter" },
  { action: "Like the pinned post on the page", platform: "Facebook", link: "https://facebook.com", buttonLabel: "Open Facebook" },
  { action: "Watch the latest reel and like it", platform: "Instagram", link: "https://instagram.com", buttonLabel: "Open Instagram" },
  { action: "Leave a genuine comment on the top post", platform: "YouTube", link: "https://youtube.com", buttonLabel: "Open YouTube" },
];

// ── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ totalSeconds, seconds, onExpire }: { totalSeconds: number; seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / totalSeconds) * 100;
  const urgent = remaining < 60;

  return (
    <div className={`flex items-center gap-2 text-sm font-mono font-bold tabular-nums ${urgent ? "text-red-400" : "text-amber-400"}`}>
      <Timer className="w-4 h-4 flex-shrink-0" />
      <span>{mins}:{String(secs).padStart(2, "0")}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${urgent ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Task Content ──────────────────────────────────────────────────────────────
function TaskContent({ task, taskIndex, onReady }: { task: any; taskIndex: number; onReady: (ready: boolean) => void }) {
  const category: string = task.category ?? "";

  if (category === "Video Watching") {
    const videoId = VIDEO_IDS[taskIndex % VIDEO_IDS.length];
    return <VideoContent videoId={videoId} onReady={onReady} />;
  }
  if (category === "Surveys") {
    const bank = SURVEY_BANKS[taskIndex % SURVEY_BANKS.length];
    return <SurveyContent questions={bank} onReady={onReady} />;
  }
  if (category === "Article Reading") {
    const article = ARTICLES[taskIndex % ARTICLES.length];
    return <ArticleContent article={article} onReady={onReady} />;
  }
  if (category === "Digital Engagement Tasks") {
    const step = ENGAGEMENT_STEPS[taskIndex % ENGAGEMENT_STEPS.length];
    return <EngagementContent step={step} onReady={onReady} />;
  }
  if (category === "AI Training Tasks") {
    const item = AI_ITEMS[taskIndex % AI_ITEMS.length];
    return <AiLabelContent item={item} onReady={onReady} />;
  }
  if (category === "Data Categorization") {
    const items = DATA_ITEMS.slice(taskIndex % DATA_ITEMS.length, (taskIndex % DATA_ITEMS.length) + 3);
    return <DataCatContent items={items.length ? items : DATA_ITEMS.slice(0, 3)} onReady={onReady} />;
  }
  // Fallback
  return <DefaultContent instructions={task.instructions} onReady={onReady} />;
}

function VideoContent({ videoId, onReady }: { videoId: string; onReady: (r: boolean) => void }) {
  const [watched, setWatched] = useState(false);
  useEffect(() => { if (watched) onReady(true); }, [watched, onReady]);
  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden bg-black aspect-video">
        <iframe
          width="100%" height="100%"
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen className="w-full h-full"
        />
      </div>
      <p className="text-xs text-muted-foreground">Watch at least 1 minute of the video, then confirm below.</p>
      <Button variant={watched ? "outline" : "default"} size="sm" className="w-full" onClick={() => setWatched(true)}>
        {watched ? <><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Video Watched ✓</> : "I've Watched the Video"}
      </Button>
    </div>
  );
}

function SurveyContent({ questions, onReady }: { questions: { q: string; opts: string[] }[]; onReady: (r: boolean) => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const allAnswered = questions.every((_, i) => answers[i]);
  useEffect(() => { onReady(allAnswered); }, [allAnswered, onReady]);

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <p className="text-sm font-medium">{i + 1}. {q.q}</p>
          <div className="grid grid-cols-1 gap-1.5">
            {q.opts.map(opt => (
              <button key={opt} onClick={() => setAnswers(a => ({ ...a, [i]: opt }))}
                className={`text-left text-sm px-3 py-2 rounded-lg border transition-all ${answers[i] === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      {allAnswered && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> All questions answered — you can submit now!
        </div>
      )}
    </div>
  );
}

function ArticleContent({ article, onReady }: { article: { title: string; body: string }; onReady: (r: boolean) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) { setScrolled(true); onReady(true); }
  };
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-base">{article.title}</h3>
      <div onScroll={handleScroll} className="h-52 overflow-y-auto pr-2 text-sm leading-relaxed text-muted-foreground space-y-3 scroll-smooth">
        {article.body.split("\n\n").map((para, i) => (
          <p key={i} className={para.startsWith("**") ? "font-semibold text-foreground" : ""}>{para.replace(/\*\*/g, "")}</p>
        ))}
      </div>
      {!scrolled && <p className="text-xs text-muted-foreground text-center animate-pulse">↓ Scroll to the bottom to complete</p>}
      {scrolled && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> Article read — you can submit now!
        </div>
      )}
    </div>
  );
}

function EngagementContent({ step, onReady }: { step: typeof ENGAGEMENT_STEPS[0]; onReady: (r: boolean) => void }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) onReady(true); }, [done, onReady]);
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{step.platform}</p>
        <p className="font-semibold text-sm">{step.action}</p>
        <a href={step.link} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="mt-2 gap-1.5 w-full">
            <ExternalLink className="w-3.5 h-3.5" />{step.buttonLabel}
          </Button>
        </a>
      </div>
      <p className="text-xs text-muted-foreground">Complete the action above, then confirm:</p>
      <Button variant={done ? "outline" : "default"} size="sm" className="w-full" onClick={() => setDone(true)}>
        {done ? <><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Action Completed ✓</> : "I've Completed the Action"}
      </Button>
    </div>
  );
}

function AiLabelContent({ item, onReady }: { item: typeof AI_ITEMS[0]; onReady: (r: boolean) => void }) {
  const [answer, setAnswer] = useState("");
  useEffect(() => { if (answer) onReady(true); }, [answer, onReady]);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Label this image for AI training</p>
      <img src={item.img} alt="Label this" className="w-full rounded-xl object-cover h-36 bg-muted" />
      <p className="font-semibold text-sm">{item.question}</p>
      <div className="grid grid-cols-3 gap-2">
        {item.options.map(opt => (
          <button key={opt} onClick={() => setAnswer(opt)}
            className={`text-sm px-2 py-2 rounded-lg border font-medium transition-all ${answer === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
            {opt}
          </button>
        ))}
      </div>
      {answer && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> Labeled "{answer}" — submit when ready!
        </div>
      )}
    </div>
  );
}

function DataCatContent({ items, onReady }: { items: typeof DATA_ITEMS; onReady: (r: boolean) => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const allDone = items.every((_, i) => answers[i]);
  useEffect(() => { if (allDone) onReady(true); }, [allDone, onReady]);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Categorize each item below</p>
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-sm font-medium">{item.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {item.options.map(opt => (
              <button key={opt} onClick={() => setAnswers(a => ({ ...a, [i]: opt }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${answers[i] === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      {allDone && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> All items categorized — submit when ready!
        </div>
      )}
    </div>
  );
}

function DefaultContent({ instructions, onReady }: { instructions?: string; onReady: (r: boolean) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (confirmed) onReady(true); }, [confirmed, onReady]);
  return (
    <div className="space-y-4">
      {instructions && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm leading-relaxed">{instructions}</div>
      )}
      <Button variant={confirmed ? "outline" : "default"} size="sm" className="w-full" onClick={() => setConfirmed(true)}>
        {confirmed ? <><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Ready to Submit ✓</> : "I've Completed the Task"}
      </Button>
    </div>
  );
}

// ── Buy Minutes Modal ────────────────────────────────────────────────────────
function BuyMinutesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const buyMutation = useBuyTranscriptionMinutes();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = (pkg: string) => {
    setLoading(pkg);
    buyMutation.mutate({ data: { package: pkg } }, {
      onSuccess: (res) => {
        if (res.authorizationUrl) {
          window.open(res.authorizationUrl, "_blank");
          toast({ title: "Payment Page Opened", description: "Complete payment in the new tab." });
        }
        onClose();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      onSettled: () => setLoading(null),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mic className="w-5 h-5 text-primary" />Buy Transcription Minutes</DialogTitle>
          <DialogDescription>Purchase minutes to complete transcription tasks. Minutes don't expire.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {MINUTE_BUNDLES.map(b => (
            <button key={b.key} onClick={() => handleBuy(b.key)} disabled={!!loading}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
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

// ── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, taskIndex, userMinutes, onComplete, onBuyMinutes }: {
  task: any; taskIndex: number; userMinutes: number; onComplete: () => void; onBuyMinutes: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const startMutation = useStartTask();
  const completeMutation = useCompleteTask();
  const [modalOpen, setModalOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [taskReady, setTaskReady] = useState(false);

  const isTranscription = task.taskType === "transcription";
  const needsMinutes = isTranscription && (userMinutes < (task.minutesCost ?? 0));

  const handleExpire = useCallback(() => {
    setExpired(true);
    toast({ title: "Time's Up!", description: "Task timer expired. Please restart.", variant: "destructive" });
  }, [toast]);

  const handleStart = () => {
    if (needsMinutes) { onBuyMinutes(); return; }
    startMutation.mutate({ id: task.id }, {
      onSuccess: (res: any) => {
        setStarted(true);
        setExpired(false);
        setTaskReady(false);
        const tl = res.timeLimitSeconds ?? task.timeLimitSeconds ?? null;
        setTimeLeft(tl);
        setModalOpen(true);
      },
      onError: (err: any) => {
        if (err.requiresMinutes) { onBuyMinutes(); return; }
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleComplete = () => {
    if (expired) { toast({ title: "Time Expired", description: "Please restart the task.", variant: "destructive" }); return; }
    completeMutation.mutate({ id: task.id, data: {} }, {
      onSuccess: (res) => {
        toast({ title: "Task Completed! 🎉", description: res.message });
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setStarted(false);
        setTimeLeft(null);
        setModalOpen(false);
        onComplete();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message ?? "Failed to complete task", variant: "destructive" }),
    });
  };

  const handleReopen = () => { setModalOpen(true); };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className={`border h-full flex flex-col transition-all ${
          task.completedByUser ? "opacity-60 border-border" :
          started ? "border-primary/50 shadow-[0_0_12px_rgba(99,102,241,0.15)]" :
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
              {isTranscription && task.minutesCost && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Mic className="w-3 h-3" />{task.minutesCost} min
                </span>
              )}
            </div>

            {isTranscription && needsMinutes && !task.completedByUser && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-300">Need {task.minutesCost} min · You have {userMinutes.toFixed(1)} min</p>
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
              ) : started && !task.completedByUser ? (
                <Button size="sm" variant="outline" onClick={handleReopen} className="border-primary/40 text-primary">
                  <Zap className="w-3 h-3 mr-1" />Continue
                </Button>
              ) : (
                <Button size="sm" onClick={handleStart} disabled={startMutation.isPending}>
                  {startMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Start</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Task Modal ── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o && started && !task.completedByUser) setModalOpen(false); else setModalOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="leading-snug pr-6">{task.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[task.difficulty] ?? DIFFICULTY_COLOR.easy}`}>{task.difficulty}</span>
              <span className="flex items-center gap-1 text-xs"><Clock className="w-3 h-3" />{task.estimatedMinutes} min</span>
              <span className="flex items-center gap-1 text-xs font-bold text-green-500"><DollarSign className="w-3 h-3" />{task.reward.toFixed(2)} reward</span>
            </DialogDescription>
          </DialogHeader>

          {/* Timer */}
          {timeLeft !== null && !expired && (
            <div className="px-1">
              <Countdown totalSeconds={timeLeft} seconds={timeLeft} onExpire={handleExpire} />
            </div>
          )}
          {expired && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> Time expired. Close this and restart the task.
            </div>
          )}

          {/* Task Content */}
          {!expired && (
            <TaskContent task={task} taskIndex={taskIndex} onReady={setTaskReady} />
          )}

          {/* Submit */}
          {!expired && (
            <Button
              className="w-full h-11 font-semibold"
              disabled={!taskReady || completeMutation.isPending}
              onClick={handleComplete}
            >
              {completeMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                : taskReady
                  ? <><CheckCircle className="w-4 h-4 mr-2" />Submit & Earn ${task.reward.toFixed(2)}</>
                  : "Complete the task above to submit"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
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
  const userLevel = (user as any)?.level ?? 1;

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
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-purple-400 hover:text-purple-300" onClick={() => setBuyMinutesOpen(true)}>Buy</Button>
        </div>
      </div>

      {/* Upgrade nudge for level 1 */}
      {userLevel === 1 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Starter tasks earn up to $0.15</p>
            <p className="text-xs text-muted-foreground">Upgrade your membership to unlock tasks paying $0.50 – $10.00+</p>
          </div>
          <a href="/membership">
            <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs">Upgrade</Button>
          </a>
        </div>
      )}

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
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No tasks available in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task, i) => (
                <TaskCard key={task.id} task={task} taskIndex={i}
                  userMinutes={userMinutes} onComplete={refetch}
                  onBuyMinutes={() => setBuyMinutesOpen(true)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BuyMinutesModal open={buyMinutesOpen} onClose={() => setBuyMinutesOpen(false)} />
    </div>
  );
}
