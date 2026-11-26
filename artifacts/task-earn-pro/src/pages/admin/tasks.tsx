import { useState } from "react";
import { useAdminGetTasks, useAdminCreateTask, useAdminUpdateTask, useAdminDeleteTask, getAdminGetTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Pencil, Trash2, Loader2, CheckSquare, ClipboardCheck } from "lucide-react";

const CATEGORIES = ["Academic Writing", "Data Entry", "Transcription", "AI Training"];

function TaskForm({ initial, onSave, onClose }: { initial?: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    reward: initial?.reward ?? "",
    fundingBudget: initial?.fundingBudget ?? "",
    maxCompletions: initial?.maxCompletions ?? 1,
    estimatedMinutes: initial?.estimatedMinutes ?? "",
    deadlineHours: initial?.deadlineHours ?? 72,
    difficulty: "hard",
    minLevel: initial?.minLevel ?? 1,
    instructions: initial?.instructions ?? "Complete every part of the task. Show your working, follow the supplied format, verify accuracy, and explain any assumptions. Submissions are checked against the requirements before the reward is approved.",
    isActive: initial?.isActive ?? true,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={e => set("title", e.target.value)} data-testid="input-title" />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          {form.category === "Academic Writing" && <p className="mt-1 text-xs text-muted-foreground">Include technical editing and research organization in engineering or computer science. Do not post requests to complete graded coursework.</p>}
        </div>
        <div>
          <Label>Reward ($)</Label>
          <Input type="number" min="0.01" step="0.01" value={form.reward} onChange={e => set("reward", e.target.value)} />
        </div>
        <div>
          <Label>Total platform budget ($)</Label>
          <Input type="number" min="0.01" step="0.01" value={form.fundingBudget} onChange={e => set("fundingBudget", e.target.value)} />
        </div>
        <div>
          <Label>Maximum accepted submissions</Label>
          <Input type="number" min="1" max="500" step="1" value={form.maxCompletions} onChange={e => set("maxCompletions", Number(e.target.value))} />
        </div>
        <div>
          <Label>Estimated minutes</Label>
          <Input type="number" min="1" max="1440" value={form.estimatedMinutes} onChange={e => set("estimatedMinutes", e.target.value)} />
        </div>
        <div>
          <Label>Submission deadline (hours)</Label>
          <Input type="number" min="1" max="720" step="1" value={form.deadlineHours} onChange={e => set("deadlineHours", e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">1–720 hours after assignment. New tasks default to 72.</p>
        </div>
        <div>
          <Label>Min Level (1-7)</Label>
          <Select value={String(form.minLevel)} onValueChange={v => set("minLevel", parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5,6,7].map(l => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.isActive ? "active" : "inactive"} onValueChange={v => set("isActive", v === "active")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Detailed instructions and quality checks (required)</Label>
          <Textarea value={form.instructions} onChange={e => set("instructions", e.target.value)} rows={5} />
          <p className="mt-1 text-xs text-muted-foreground">Minimum 50 characters. State the deliverable, format, accuracy requirements, and review criteria.</p>
        </div>
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        Maximum task payout is <strong className="text-foreground">${(Number(form.reward || 0) * Number(form.maxCompletions || 0)).toFixed(2)}</strong>.
        The total platform budget must cover all accepted places. This is an in-app payout cap, not an escrow transfer. Rewards are credited only when work is approved.
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => onSave(form)} data-testid="button-save-task">Save Task</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useAdminGetTasks();
  const createMutation = useAdminCreateTask();
  const updateMutation = useAdminUpdateTask();
  const deleteMutation = useAdminDeleteTask();

  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminGetTasksQueryKey() });

  const handleCreate = (data: any) => {
    createMutation.mutate({ data }, {
      onSuccess: () => { toast({ title: "Task Created" }); setShowCreate(false); invalidate(); },
      onError: (error: any) => toast({ title: "Could not create task", description: error.data?.error ?? error.message ?? "Check the task details and budget.", variant: "destructive" }),
    });
  };

  const handleUpdate = (data: any) => {
    updateMutation.mutate({ id: editTask.id, data }, {
      onSuccess: () => { toast({ title: "Task Updated" }); setEditTask(null); invalidate(); },
      onError: (error: any) => toast({ title: "Could not update task", description: error.data?.error ?? error.message ?? "Check the task details and budget.", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Task Deactivated" }); invalidate(); },
      onError: (error: any) => toast({ title: "Could not deactivate task", description: error.data?.error ?? error.message ?? "Please try again.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground mt-1">Publish work with a fixed reward pool and capped places</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/task-submissions"><Button variant="outline"><ClipboardCheck className="mr-2 h-4 w-4" />Review submissions</Button></Link>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-task">
            <Plus className="w-4 h-4 mr-2" />New Task
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />All Tasks ({tasks?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Title", "Category", "Reward", "Budget / places", "Deadline", "Level", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks?.map(task => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`task-row-${task.id}`}>
                      <td className="py-3 px-3 font-medium max-w-[200px] truncate">{task.title}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{task.category}</td>
                      <td className="py-3 px-3 text-green-500 font-medium">${task.reward.toFixed(2)}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">${task.fundingBudget.toFixed(2)} · {task.maxCompletions} max</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{task.deadlineHours}h</td>
                      <td className="py-3 px-3 text-muted-foreground">L{task.minLevel}+</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={task.isActive ? "text-green-500 border-green-500/30" : "text-muted-foreground"}>
                          {task.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditTask(task)} data-testid={`button-edit-${task.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(task.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-${task.id}`}>
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
          <TaskForm onSave={(data) => handleCreate({
            ...data,
            taskType: "written",
            reward: Number(data.reward),
            fundingBudget: Number(data.fundingBudget),
            maxCompletions: Number(data.maxCompletions),
            estimatedMinutes: Number(data.estimatedMinutes),
            deadlineHours: Number(data.deadlineHours),
            minLevel: Number(data.minLevel),
            difficulty: "hard",
          })} onClose={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTask} onOpenChange={() => setEditTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          {editTask && <TaskForm initial={editTask} onSave={(data) => handleUpdate({
            ...data,
            taskType: "written",
            reward: Number(data.reward),
            fundingBudget: Number(data.fundingBudget),
            maxCompletions: Number(data.maxCompletions),
            estimatedMinutes: Number(data.estimatedMinutes),
            deadlineHours: Number(data.deadlineHours),
            minLevel: Number(data.minLevel),
            difficulty: "hard",
          })} onClose={() => setEditTask(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
