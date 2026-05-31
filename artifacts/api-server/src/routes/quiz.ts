import { Router } from "express";
import { db, usersTable, quizQuestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/quiz/questions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const all = await db.select().from(quizQuestionsTable);
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 10);
    res.json(shuffled.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quiz/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { answers } = req.body as { answers: { questionId: number; answer: string }[] };
    if (!answers || !Array.isArray(answers)) {
      res.status(400).json({ error: "Answers required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (user.quizCompleted) {
      res.status(400).json({ error: "Quiz already completed" });
      return;
    }

    const questions = await db.select().from(quizQuestionsTable);
    const qMap = new Map(questions.map(q => [q.id, q]));

    let score = 0;
    for (const ans of answers) {
      const q = qMap.get(ans.questionId);
      if (q && q.correctAnswer === ans.answer) score++;
    }

    const total = answers.length;
    const percentage = (score / total) * 100;
    let bonus = 0;
    if (percentage >= 80) bonus = 5.0;
    else if (percentage >= 60) bonus = 3.0;
    else if (percentage >= 40) bonus = 2.0;
    else bonus = 1.0;

    await db.update(usersTable).set({
      quizCompleted: true,
      balance: user.balance + bonus,
      totalBonusEarnings: user.totalBonusEarnings + bonus,
      totalEarned: user.totalEarned + bonus,
    }).where(eq(usersTable.id, req.userId!));

    let message = "";
    if (percentage >= 80) message = "Outstanding! Maximum bonus earned.";
    else if (percentage >= 60) message = "Well done! Good bonus earned.";
    else if (percentage >= 40) message = "Not bad! Starter bonus earned.";
    else message = "Keep learning! Minimum bonus credited.";

    res.json({ score, totalQuestions: total, bonusEarned: bonus, message });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
