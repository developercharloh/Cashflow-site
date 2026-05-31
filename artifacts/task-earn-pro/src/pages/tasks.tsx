import { useState } from "react";
import { useGetTasks, useGetTaskCategories, useStartTask, useCompleteTask, getGetTasksQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, DollarSign, Zap, CheckCircle, Loader2, BarChart2, BookOpen, Video, MessageCircle, Brain, Database, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Surveys": <BarChart2 className="w-4 h-4" />,
  "Video Watching": <Video className="w-4 h-4" />,
  "Article Reading": <BookOpen className="w-4 h-4" />,
  "Digital Engagement Tasks": <MessageCircle className="w-4 h-4" />,
  "AI Training Tasks": <Brain className="w-4 h-4" />,
  "Data Categorization": <Database className="w-4 h-4" />,
  "Daily Check-In Tasks": <Calendar className="w-4 h-4" />,
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-green-500/10 text-green-500 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  hard: "bg-red-500/10 text-red-500 border-red-500/20",
};

function TaskCard({ task, onComplete }: { task: any; onComplete: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const startMutation = useStartTask();
  const completeMutation = useCompleteTask();
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    startMutation.mutate({ id: task.id }, {
      onSuccess: () => setStarted(true),
      onError: () => setStarted(true),
    });
  };

  const handleComplete = () => {
    completeMutation.mutate({ id: task.id, data: {} }, {
      onSuccess: (res) => {
        toast({
          title: "Task Completed!",
          description: res.message,
        });
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        onComplete();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border-border h-full flex flex-col transition-all ${task.completedByUser ? "opacity-60" : "hover:border-primary/30"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              {CATEGORY_ICONS[task.category]}
              <span>{task.category}</span>
            </div>
            {task.completedByUser && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
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
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-lg font-bold text-green-500">
              <DollarSign className="w-4 h-4" />{task.reward.toFixed(2)}
            </div>
            {task.completedByUser ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30">Completed</Badge>
            ) : !started ? (
              <Button size="sm" onClick={handleStart} disabled={startMutation.isPending} data-testid={`button-start-${task.id}`}>
                {startMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Start</>}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleComplete} disabled={completeMutation.isPending} data-testid={`button-complete-${task.id}`}>
                {completeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 mr-1" />Done</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Tasks() {
  const [activeCategory, setActiveCategory] = useState("all");
  const { data: categories } = useGetTaskCategories();
  const { data: tasks, isLoading, refetch } = useGetTasks(
    activeCategory !== "all" ? { category: activeCategory } : {},
    { query: { queryKey: getGetTasksQueryKey(activeCategory !== "all" ? { category: activeCategory } : {}) } }
  );

  const allCategories = ["all", ...(categories?.map(c => c.name) ?? [])];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Marketplace</h1>
        <p className="text-muted-foreground mt-1">Complete tasks to earn real money</p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex-nowrap w-max gap-1">
            {allCategories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="whitespace-nowrap text-xs sm:text-sm">
                {cat === "all" ? "All Tasks" : cat}
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
                <TaskCard key={task.id} task={task} onComplete={refetch} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
