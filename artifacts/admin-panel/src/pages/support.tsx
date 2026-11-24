import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownLeft, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { get, post } from "@/api";
import type { AdminSupportThread, AdminSupportThreadDetail, SupportMessage } from "@workspace/api-client-react";

type StatusFilter = "open" | "replied" | "all";

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function MessageRow({ message }: { message: SupportMessage }) {
  const fromAdmin = message.authorType === "admin";
  return (
    <div className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[88%] rounded-2xl px-4 py-3 ${fromAdmin ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-800 text-slate-100"}`}>
        <p className="mb-1 text-[11px] font-semibold opacity-70">{fromAdmin ? "You · Support" : "Worker"}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        <time className="mt-2 block text-right text-[10px] opacity-60" dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleString()}
        </time>
      </article>
    </div>
  );
}

export default function SupportPage() {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [threads, setThreads] = useState<AdminSupportThread[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminSupportThreadDetail | null>(null);
  const [body, setBody] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [sendError, setSendError] = useState("");

  const loadThreads = useCallback(async (quiet = false) => {
    if (!quiet) setListLoading(true);
    try {
      const result = await get<AdminSupportThread[]>(`/admin/support/threads?status=${status}`);
      setThreads(result);
      setListError("");
      setSelectedId((current) => current ?? result[0]?.id ?? null);
    } catch (error) {
      setListError(readableError(error));
    } finally {
      if (!quiet) setListLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadThreads();
    const timer = window.setInterval(() => void loadThreads(true), 20000);
    return () => window.clearInterval(timer);
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      setDetailError("");
      return;
    }
    setDetail(null);
    setDetailError("");
    let active = true;
    const loadDetail = async (quiet = false) => {
      if (!quiet) setDetailLoading(true);
      try {
        const result = await get<AdminSupportThreadDetail>(`/admin/support/threads/${selectedId}`);
        if (active) {
          setDetail(result);
          setDetailError("");
        }
      } catch (error) {
        if (active) setDetailError(readableError(error));
      } finally {
        if (active && !quiet) setDetailLoading(false);
      }
    };
    void loadDetail();
    const timer = window.setInterval(() => void loadDetail(true), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!selectedId || !trimmed || sending) return;
    setSending(true);
    setSendError("");
    try {
      const result = await post<AdminSupportThreadDetail>(`/admin/support/threads/${selectedId}/messages`, { body: trimmed });
      setDetail(result);
      setBody("");
      await loadThreads(true);
    } catch (error) {
      setSendError(readableError(error));
    } finally {
      setSending(false);
    }
  };

  const selected = threads.find((thread) => thread.id === selectedId) ?? detail?.thread;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Worker support</h1>
          <p className="mt-1 text-sm text-slate-400">Review worker conversations and reply from the admin workspace.</p>
        </div>
        <button type="button" onClick={() => void loadThreads()} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Filter support threads">
        {(["open", "replied", "all"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setStatus(item);
              setSelectedId(null);
            }}
            aria-pressed={status === item}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${status === item ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"}`}
          >
            {item === "open" ? "Needs reply" : item === "replied" ? "Waiting on worker" : "All conversations"}
          </button>
        ))}
      </div>

      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <aside className="border-b border-slate-800 lg:border-b-0 lg:border-r" aria-label="Support conversations">
          {listLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : listError ? (
            <div role="alert" className="p-5 text-center text-sm text-red-300">{listError}</div>
          ) : !threads.length ? (
            <div className="p-6 text-center text-sm text-slate-500">No conversations in this view.</div>
          ) : (
            <ul className="max-h-[300px] divide-y divide-slate-800 overflow-y-auto lg:max-h-[560px]">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(thread.id)}
                    aria-current={selectedId === thread.id ? "true" : undefined}
                    className={`w-full p-4 text-left transition-colors ${selectedId === thread.id ? "bg-blue-950/60" : "hover:bg-slate-800/70"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-100">{thread.workerName}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${thread.status === "open" ? "bg-amber-900/50 text-amber-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                        {thread.status === "open" ? "Needs reply" : "Replied"}
                      </span>
                    </div>
                    <span className="mt-1 block truncate text-xs text-slate-500">{thread.workerEmail}</span>
                    <span className="mt-2 block line-clamp-2 text-xs leading-5 text-slate-400">{thread.latestMessage}</span>
                    <time className="mt-2 block text-[10px] text-slate-600" dateTime={thread.updatedAt}>{new Date(thread.updatedAt).toLocaleString()}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-w-0 flex-col" aria-label="Selected support conversation">
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
              <MessageCircle className="h-9 w-9" />
              <p className="mt-3 text-sm">Select a conversation to read and reply.</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex flex-1 justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : detailError && !detail ? (
            <div role="alert" className="p-6 text-sm text-red-300">{detailError}</div>
          ) : (
            <>
              <header className="border-b border-slate-800 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-900/60 text-blue-200">
                    <ArrowDownLeft className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-white">{selected?.workerName ?? "Worker"}</h2>
                    <p className="truncate text-xs text-slate-500">{selected?.workerEmail}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${selected?.status === "open" ? "bg-amber-900/50 text-amber-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                    {selected?.status === "open" ? "Needs reply" : "Replied"}
                  </span>
                </div>
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
                {detail?.messages.map((message: SupportMessage) => <MessageRow key={message.id} message={message} />)}
                {!detail?.messages.length && <p className="py-10 text-center text-sm text-slate-500">No messages in this conversation yet.</p>}
              </div>
              <form onSubmit={sendReply} className="border-t border-slate-800 p-3 sm:p-4">
                <label htmlFor="support-reply" className="sr-only">Reply to worker</label>
                <textarea
                  id="support-reply"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={5000}
                  rows={3}
                  placeholder="Write a reply…"
                  disabled={sending}
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{body.length.toLocaleString()} / 5,000</span>
                  <button type="submit" disabled={!body.trim() || sending} className="flex items-center rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {sending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                    Send reply
                  </button>
                </div>
                {sendError && <p role="alert" className="mt-2 text-sm text-red-300">{sendError}</p>}
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
