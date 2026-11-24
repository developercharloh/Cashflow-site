import { Link } from "wouter";
import { ArrowLeft, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuizPage() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </div>
      <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" /> Coming soon
      </p>
      <h1 className="font-serif text-3xl">Simple Quiz</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        This feature is not available yet. Browse the available work categories while we prepare it.
      </p>
      <Link href="/dashboard" className="mt-7">
        <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to home</Button>
      </Link>
    </main>
  );
}
