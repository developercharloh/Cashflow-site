import { useEffect, useState } from "react";
import { get, post, patch, del } from "@/api";
import { Plus, Pencil, Trash2, RefreshCw, X, CheckCircle, XCircle } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string;
  category: string;
  reward: number;
  estimatedMinutes: number;
  difficulty: string;
  minLevel: number;
  isActive: boolean;
  completionCount: number;
  createdAt: string;
}

interface UserTask {
  id: number;
  userId: number;
  taskId: number;
  status: string;
  userName: string;
  userEmail: string;
  taskTitle: string;
  reward: number;
  completedAt: string | null;
  startedAt: string;
}

const DIFF_COLOR: Record<string, string> = {
  easy: "text-green-400 bg-green-900/30 border-green-800/50",
  medium: "text-yellow-400 bg-yellow-900/30 border-yellow-800/50",
  hard: "text-red-400 bg-red-900/30 border-red-800/50",
};

const defaultTask = { title: "", description: "", category: "survey", reward: 0.05, estimatedMinutes: 5, difficulty: "easy", minLevel: 1, isActive: true };

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "completions">("tasks");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [form, setForm] = useState(defaultTask);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const n = (v: unknown) => Number(v) || 0;

  const load = () => {
    setLoading(true);
    Promise.all([
      get<Task[]>("/admin/tasks"),
      get<UserTask[]>("/admin/completions").catch(() => [] as UserTask[]),
    ]).then(([t, c]) => { setTasks(t); setCompletions(c); }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => { setForm(defaultTask); setModal("create"); };
  const openEdit = (t: Task) => { setForm({ title: t.title, description: t.description, category: t.category, reward: t.reward, estimatedMinutes: t.estimatedMinutes, difficulty: t.difficulty, minLevel: t.minLevel, isActive: t.isActive }); setEditId(t.id); setModal("edit"); };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === "create") {
        await post("/admin/tasks", form);
      } else if (editId) {
        await patch(`/admin/tasks/${editId}`, form);
      }
      setModal(null);
      load();
    } catch (e) { alert((e as Error).message); }
    setSaving(false);
  };

  const destroy = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    setDeleting(id);
    try { await del(`/admin/tasks/${id}`); setTasks(prev => prev.filter(t => t.id !== id)); }
    catch (e) { alert((e as Error).message); }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-slate-400">Manage tasks and completions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["tasks", "completions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs rounded-xl border transition-colors ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"}`}>
            {t === "tasks" ? `Tasks (${tasks.length})` : `Completions (${completions.length})`}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center text-slate-400 text-sm py-10">Loading…</div> : (
        tab === "tasks" ? (
          <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Title", "Category", "Reward", "Difficulty", "Level", "Completions", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-semibold">{t.title}</p>
                      <p className="text-slate-500 text-[10px]">~{t.estimatedMinutes}min</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded">{t.category}</span></td>
                    <td className="px-4 py-3 text-xs text-green-400 font-bold">${n(t.reward).toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${DIFF_COLOR[t.difficulty] ?? ""}`}>{t.difficulty}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-400">L{t.minLevel}+</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{t.completionCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.isActive ? "text-green-400 bg-green-900/30 border-green-800/50" : "text-slate-400 bg-slate-800 border-slate-700"}`}>
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-blue-900/40 text-slate-400 hover:text-blue-400 transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => destroy(t.id)} disabled={deleting === t.id} className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-40">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && <div className="text-center text-slate-500 text-sm py-8">No tasks found</div>}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["User", "Task", "Status", "Reward", "Started", "Completed"].map(h => (
                    <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completions.map(c => (
                  <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-medium">{c.userName}</p>
                      <p className="text-slate-500 text-[10px]">{c.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{c.taskTitle}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${c.status === "completed" ? "text-green-400 bg-green-900/30 border-green-800/50" : "text-yellow-400 bg-yellow-900/30 border-yellow-800/50"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-green-400">${(c.reward ?? 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.startedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {completions.length === 0 && <div className="text-center text-slate-500 text-sm py-8">No completions yet</div>}
          </div>
        )
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl" style={{ background: "#111827" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">{modal === "create" ? "Create Task" : "Edit Task"}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: "title", label: "Title", type: "text" },
                { key: "description", label: "Description", type: "text" },
                { key: "category", label: "Category", type: "text" },
                { key: "reward", label: "Reward ($)", type: "number" },
                { key: "estimatedMinutes", label: "Est. Minutes", type: "number" },
              ].map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-slate-400">{label}</label>
                  <input
                    type={type} value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                    {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Min Level</label>
                  <select value={form.minLevel} onChange={e => setForm(p => ({ ...p, minLevel: parseInt(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                    {[1, 2, 3, 4].map(l => <option key={l} value={l}>Level {l}+</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="accent-blue-500" />
                <span className="text-xs text-slate-300">Active (visible to users)</span>
              </label>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2">
                {saving ? "Saving…" : modal === "create" ? <><Plus className="w-3.5 h-3.5" /> Create</> : <><CheckCircle className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
