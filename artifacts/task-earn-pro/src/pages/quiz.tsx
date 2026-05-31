import { useState } from "react";
import { useLocation } from "wouter";
import { useGetQuizQuestions, useSubmitQuiz, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Trophy, Loader2, ChevronRight, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Quiz() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; totalQuestions: number; bonusEarned: number; message: string } | null>(null);

  const { data: questions, isLoading } = useGetQuizQuestions();
  const submitMutation = useSubmitQuiz();

  if (isLoading || !questions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const handleSelect = (option: string) => {
    setSelectedAnswer(option);
  };

  const handleNext = () => {
    if (!selectedAnswer) return;
    const newAnswers = { ...answers, [currentQuestion.id]: selectedAnswer };
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentIndex === questions.length - 1) {
      const payload = Object.entries(newAnswers).map(([qId, answer]) => ({
        questionId: parseInt(qId),
        answer,
      }));
      submitMutation.mutate({ data: { answers: payload } }, {
        onSuccess: (res) => {
          setResult(res);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: () => {
          toast({ title: "Submission failed", variant: "destructive" });
        }
      });
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  if (result) {
    const pct = Math.round((result.score / result.totalQuestions) * 100);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center space-y-6"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Quiz Complete!</h1>
            <p className="text-muted-foreground mt-2">{result.message}</p>
          </div>
          <Card className="border-border">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Score</span>
                <Badge className="text-lg px-4 py-1">{result.score}/{result.totalQuestions}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="text-2xl font-bold text-primary">{pct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Bonus Earned</span>
                <span className="text-2xl font-bold text-green-500">${result.bonusEarned.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
            <Star className="w-4 h-4 text-yellow-500" />
            Bonus has been credited to your wallet
          </div>
          <Button className="w-full" size="lg" onClick={() => setLocation("/dashboard")}>
            Go to Dashboard <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome Quiz</h1>
          <p className="text-muted-foreground mt-1">Answer correctly to earn a bigger bonus</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg leading-relaxed">
                  {currentQuestion.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt}
                    data-testid={`option-${opt}`}
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                      selectedAnswer === opt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedAnswer === opt ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {selectedAnswer === opt && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <span>{opt}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <Button
          className="w-full"
          size="lg"
          onClick={handleNext}
          disabled={!selectedAnswer || submitMutation.isPending}
          data-testid="button-next"
        >
          {submitMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : currentIndex === questions.length - 1 ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Submit Quiz</>
          ) : (
            <>Next <ChevronRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
