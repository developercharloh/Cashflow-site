import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Headset, Loader2, MessageCircle, Send } from "lucide-react";
import { Link } from "wouter";
import {
  getGetSupportThreadQueryKey,
  useCreateSupportMessage,
  useGetSupportThread,
} from "@workspace/api-client-react";
import type { SupportMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function errorMessage(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromSupport = message.authorType === "admin";
  return (
    <div className={`flex ${fromSupport ? "justify-start" : "justify-end"}`}>
      <article className={`max-w-[88%] rounded-2xl px-4 py-3 ${
        fromSupport ? "border border-border bg-card" : "bg-primary text-primary-foreground"
      }`}>
        <p className="mb-1 text-[11px] font-semibold opacity-75">{fromSupport ? "Lipwa Tasks Support" : "You"}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        <time className="mt-2 block text-right text-[10px] opacity-65" dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleString()}
        </time>
      </article>
    </div>
  );
}

export default function SupportPage() {
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const threadQueryKey = [...getGetSupportThreadQueryKey(), user?.id];
  const { data, isLoading, isError, refetch } = useGetSupportThread({
    query: {
      queryKey: threadQueryKey,
      refetchInterval: 15000,
      refetchOnMount: "always",
      enabled: !!user,
    },
  });
  const sendMessage = useCreateSupportMessage();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sendMessage.isPending) return;
    sendMessage.mutate(
      { data: { body: trimmed } },
      {
        onSuccess: async () => {
          setBody("");
          await queryClient.invalidateQueries({ queryKey: threadQueryKey });
        },
        onError: (error) => toast({
          title: "Message not sent",
          description: errorMessage(error),
          variant: "destructive",
        }),
      },
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-136px)] max-w-2xl flex-col px-4 pb-24 pt-5">
      <header className="mb-5">
        <Link href="/profile" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to account
        </Link>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Contact support</h1>
            <p className="mt-1 text-sm text-muted-foreground">Send us a message and replies will appear here.</p>
          </div>
        </div>
      </header>

      <section aria-label="Support conversation" className="flex min-h-64 flex-1 flex-col rounded-2xl border border-border bg-card/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="h-4 w-4 text-primary" />
            {data?.thread
              ? data.thread.status === "resolved"
                ? "Resolved · reply to reopen"
                : data.thread.status === "replied"
                  ? "Support replied"
                  : "Conversation"
              : "New conversation"}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()} aria-label="Refresh conversation">
            Refresh
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : isError ? (
            <div role="alert" className="py-8 text-center">
              <p className="text-sm font-semibold">Your conversation could not be loaded.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : data?.messages.length ? (
            data.messages.map((message) => <MessageBubble key={message.id} message={message} />)
          ) : (
            <div className="mx-auto max-w-sm py-10 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 font-semibold">How can we help?</p>
              <p className="mt-1 text-sm text-muted-foreground">Send your first message to start a private conversation with our support team.</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-border p-3 sm:p-4">
          <label htmlFor="support-message" className="sr-only">Your message</label>
          <Textarea
            id="support-message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Write your message…"
            className="resize-y bg-background"
            disabled={sendMessage.isPending}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.length.toLocaleString()} / 5,000</span>
            <Button type="submit" disabled={!body.trim() || sendMessage.isPending}>
              {sendMessage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send message
            </Button>
          </div>
          {sendMessage.isError && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage(sendMessage.error)}</p>}
        </form>
      </section>
    </div>
  );
}
