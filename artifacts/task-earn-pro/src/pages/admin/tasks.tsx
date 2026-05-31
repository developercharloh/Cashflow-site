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
import { Plus, Pencil, Trash2, Loader2, CheckSquare } from "lucide-react";

const CATEGORIES = ["Surveys", "Video Watching", "Article Reading", "Digital Engagement Tasks", "AI Training Tasks", "Data Categorization", "Daily Check-In Tasks"];

function TaskForm({ initial, onSave, onClose }: { initial?: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    reward: initial?.reward ?? "",
    estimatedMinutes: initial?.estimatedMinutes ?? "",
    difficulty: initial?.difficulty ?? "easy",
    minLevel: initial?.minLevel ?? 1,
    instructions: initial?.instructions ?? "",
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
        </div>
        <div>
          <Label>Reward ($)</Label>
          <Input type="number" min="0" step="0.01" value={form.reward} onChange={e => set("reward", parseFloat(e.target.value))} />
        </div>
        <div>
          <Label>Est. Minutes</Label>
          <Input type="number" min="1" value={form.estimatedMinutes} onChange={e => set("estimatedMinutes", parseInt(e.target.value))} />
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Min Level (1-4)</Label>
          <Select value={String(form.minLevel)} onValueChange={v => set("minLevel", parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4].map(l => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
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
          <Label>Instructions (optional)</Label>
          <Textarea value={form.instructions} onChange={e => set("instructions", e.target.value)} rows={2} />
        </div>
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
      onSuccess: () => { toast({ title: "Task Created" }); setShowCreate(false); invalidate(); }
    });
  };

  const handleUpdate = (data: any) => {
    updateMutation.mutate({ id: editTask.id, data }, {
      onSuccess: () => { toast({ title: "Task Updated" }); setEditTask(null); invalidate(); }
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Task Deactivated" }); invalidate(); }
    });
  };

  const DIFF_COLOR: Record<string, string> = {
    easy: "text-green-500 border-green-500/30",
    medium: "text-yellow-500 border-yellow-500/30",
    hard: "text-red-500 border-red-500/30",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage available tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-task">
          <Plus className="w-4 h-4 mr-2" />New Task
        </Button>
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
                    {["Title", "Category", "Reward", "Difficulty", "Level", "Status", "Actions"].map(h => (
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
                      <td className="py-3 px-3"><Badge variant="outline" className={`text-xs ${DIFF_COLOR[task.difficulty] ?? ""}`}>{task.difficulty}</Badge></td>
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
          <TaskForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTask} onOpenChange={() => setEditTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          {editTask && <TaskForm initial={editTask} onSave={handleUpdate} onClose={() => setEditTask(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
