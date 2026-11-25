import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminGetSupportThreadQueryKey,
  getAdminListSupportThreadsQueryKey,
  useAdminCreateSupportMessage,
  useAdminGetSupportThread,
  useAdminListSupportThreads,
  useAdminResolveSupportThread,
} from "@workspace/api-client-react";
import type { AdminSupportThread, AdminSupportThreadDetail, SupportMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Headset, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";

type StatusFilter = "open" | "replied" | "resolved" | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Needs reply" },
  { value: "replied", label: "Waiting on worker" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All tickets" },
];

function readableError(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  const message = apiError.data?.error ?? apiError.message;
  return message && !/<!doctype|<html/i.test(message)
    ? message
    : "Support tickets could not be loaded. Please try again.";
}

function statusLabel(status?: AdminSupportThread["status"]) {
  if (status === "open") return "Needs reply";
  if (status === "resolved") return "Resolved";
  return "Waiting on worker";
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromSupport = message.authorType === "admin";
  return (
    <div className={`flex ${fromSupport ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[88%] rounded-2xl px-4 py-3 ${
        fromSupport
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground"
      }`}>
        <p className="mb-1 text-[11px] font-semibold opacity-75">{fromSupport ? "You · Support" : "Worker"}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        <time className="mt-2 block text-right text-[10px] opacity-65" dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleString()}
        </time>
      </article>
    </div>
  );
}

export default function AdminSupportPage() {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const threadsQuery = useAdminListSupportThreads(
    { status },
    {
      query: {
        queryKey: getAdminListSupportThreadsQueryKey({ status }),
        refetchInterval: 20_000,
        refetchOnMount: "always",
      },
    },
  );
  const detailQuery = useAdminGetSupportThread(selectedId ?? 0, {
    query: {
      queryKey: getAdminGetSupportThreadQueryKey(selectedId ?? 0),
      enabled: selectedId !== null,
      refetchInterval: 15_000,
      refetchOnMount: "always",
    },
  });
  const sendMutation = useAdminCreateSupportMessage();
  const resolveMutation = useAdminResolveSupportThread();
  const threads = threadsQuery.data ?? [];
  const selected = threads.find((thread) => thread.id === selectedId) ?? detailQuery.data?.thread;

  useEffect(() => {
    setSelectedId((current) =>
      current !== null && threads.some((thread) => thread.id === current)
        ? current
        : threads[0]?.id ?? null,
    );
  }, [status, threads]);

  const refresh = () => {
    void threadsQuery.refetch();
    if (selectedId !== null) void detailQuery.refetch();
  };

  const sendReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = body.trim();
    if (selectedId === null || !message || sendMutation.isPending) return;

    sendMutation.mutate(
      { id: selectedId, data: { body: message } },
      {
        onSuccess: async (result) => {
          setBody("");
          queryClient.setQueryData<AdminSupportThreadDetail>(
            getAdminGetSupportThreadQueryKey(selectedId),
            result,
          );
          await queryClient.invalidateQueries({ queryKey: getAdminListSupportThreadsQueryKey() });
          toast({ title: "Reply sent" });
        },
        onError: (error) => toast({
          title: "Reply not sent",
          description: readableError(error),
          variant: "destructive",
        }),
      },
    );
  };

  const resolveThread = () => {
    if (selectedId === null || resolveMutation.isPending) return;
    resolveMutation.mutate(
      { id: selectedId },
      {
        onSuccess: async (result) => {
          queryClient.setQueryData<AdminSupportThreadDetail>(
            getAdminGetSupportThreadQueryKey(selectedId),
            result,
          );
          await queryClient.invalidateQueries({ queryKey: getAdminListSupportThreadsQueryKey() });
          toast({ title: "Ticket marked resolved" });
        },
        onError: (error) => toast({
          title: "Could not resolve ticket",
          description: readableError(error),
          variant: "destructive",
        }),
      },
    );
  };

  return (
    <div className="space-y-5 px-4 py-5 sm:px-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support tickets</h1>
            <p className="mt-1 text-sm text-muted-foreground">Read worker messages and reply from here.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      <nav aria-label="Filter support tickets" className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => {
              setSelectedId(null);
              setStatus(filter.value);
            }}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              status === filter.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      <div className="grid min-h-[min(72dvh,760px)] overflow-hidden rounded-2xl border border-border bg-card/60 md:grid-cols-[minmax(250px,340px)_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r" aria-label="Worker support tickets">
          {threadsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : threadsQuery.isError ? (
            <div role="alert" className="p-5 text-center text-sm text-destructive">
              <p>{readableError(threadsQuery.error)}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void threadsQuery.refetch()}>Try again</Button>
            </div>
          ) : !threads.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No tickets in this view.</div>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto md:max-h-[min(72dvh,760px)]">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    aria-current={selectedId === thread.id ? "true" : undefined}
                    onClick={() => setSelectedId(thread.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedId === thread.id ? "bg-primary/10" : "hover:bg-muted/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{thread.workerName}</span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                        thread.status === "open"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          : thread.status === "resolved"
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                      }`}>
                        {statusLabel(thread.status)}
                      </span>
                    </div>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{thread.workerEmail}</span>
                    <span className="mt-2 block line-clamp-2 text-xs leading-5 text-muted-foreground">{thread.latestMessage}</span>
                    <time className="mt-2 block text-right text-[10px] text-muted-foreground" dateTime={thread.updatedAt}>
                      {new Date(thread.updatedAt).toLocaleString()}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[360px] min-w-0 flex-col" aria-label="Selected support conversation">
          {selectedId === null ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageCircle className="h-9 w-9" />
              <p className="mt-3 text-sm">{threads.length ? "Select a ticket to read and reply." : "Worker messages will appear here."}</p>
            </div>
          ) : detailQuery.isLoading && !detailQuery.data ? (
            <div className="flex flex-1 justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : detailQuery.isError && !detailQuery.data ? (
            <div role="alert" className="p-6 text-sm text-destructive">{readableError(detailQuery.error)}</div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{selected?.workerName ?? "Worker"}</h2>
                  <p className="truncate text-xs text-muted-foreground">{selected?.workerEmail}</p>
                </div>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
                  {statusLabel(selected?.status)}
                </span>
                {selected?.status !== "resolved" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resolveThread}
                    disabled={resolveMutation.isPending}
                  >
                    {resolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Resolve
                  </Button>
                )}
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
                {detailQuery.data?.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              </div>
              <form onSubmit={sendReply} className="space-y-3 border-t border-border p-3 sm:p-4">
                <label htmlFor="admin-support-reply" className="sr-only">Reply to worker</label>
                <Textarea
                  id="admin-support-reply"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={5000}
                  rows={3}
                  placeholder="Write a reply to the worker…"
                  className="resize-y bg-background"
                  disabled={sendMutation.isPending}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{body.length.toLocaleString()} / 5,000</span>
                  <Button type="submit" disabled={!body.trim() || sendMutation.isPending}>
                    {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send reply
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
