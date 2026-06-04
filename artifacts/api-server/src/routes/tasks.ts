import { Router } from "express";
import { db, usersTable, tasksTable, userTasksTable, transactionsTable, notificationsTable, taskAttemptsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { getLevelName } from "./auth";
import { getRandomQuestions, CATEGORY_DESCRIPTIONS, QUESTION_BANK } from "../lib/questionBank";

const router = Router();

// ─── Seed tasks (called once on startup if no tasks exist) ────────────────────

const TASK_SEEDS = [
  // Data Categorization
  { title: "Data Categorization Basics", description: "Classify common data items into the correct organizational categories.", category: "Data Categorization", reward: 0.15, estimatedMinutes: 5, timeLimitSeconds: 300, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Advanced Data Classification", description: "Categorize complex data types including financial, medical, and legal records.", category: "Data Categorization", reward: 0.25, estimatedMinutes: 8, timeLimitSeconds: 420, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  { title: "Enterprise Data Sorting", description: "Sort enterprise-level datasets into precise regulatory and operational categories.", category: "Data Categorization", reward: 0.40, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Medical Record Classification", description: "Correctly identify and sort healthcare data into proper medical record categories.", category: "Data Categorization", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Legal Document Categorization", description: "Distinguish between different types of legal and compliance documents.", category: "Data Categorization", reward: 0.35, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  // Text Annotation
  { title: "Sentiment Analysis Basics", description: "Label text passages with the correct sentiment: positive, negative, or neutral.", category: "Text Annotation", reward: 0.15, estimatedMinutes: 5, timeLimitSeconds: 300, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Named Entity Recognition", description: "Identify and classify named entities — people, organizations, and locations — in text.", category: "Text Annotation", reward: 0.25, estimatedMinutes: 8, timeLimitSeconds: 420, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  { title: "Intent Classification", description: "Annotate text messages with their underlying user intent for NLP training.", category: "Text Annotation", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  { title: "Advanced Linguistic Annotation", description: "Apply expert-level linguistic labels including idioms, polysemy, and discourse relations.", category: "Text Annotation", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Emotion Detection in Text", description: "Accurately identify emotional states expressed in written customer feedback.", category: "Text Annotation", reward: 0.35, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  // Questionnaires
  { title: "Survey Design Principles", description: "Apply correct questionnaire design principles to validate survey structures.", category: "Questionnaires", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Bias Detection in Surveys", description: "Identify common biases in survey questions including leading and double-barreled questions.", category: "Questionnaires", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Advanced Survey Methodology", description: "Apply expert knowledge of sampling methods, validity, and reliability in survey research.", category: "Questionnaires", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Market Research Questionnaire Review", description: "Evaluate market research questionnaire structures for methodological soundness.", category: "Questionnaires", reward: 0.35, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  // AI Training Tasks
  { title: "AI Image Labeling Concepts", description: "Answer questions about correct AI training data labeling for computer vision models.", category: "AI Training Tasks", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Machine Learning Data Quality", description: "Assess training data quality issues including label noise, bias, and imbalance.", category: "AI Training Tasks", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "NLP Model Training Concepts", description: "Demonstrate knowledge of natural language processing training data requirements.", category: "AI Training Tasks", reward: 0.40, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  { title: "Advanced AI Annotation Standards", description: "Apply expert-level AI training annotation standards including RLHF and semantic segmentation.", category: "AI Training Tasks", reward: 0.60, estimatedMinutes: 15, timeLimitSeconds: 720, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Autonomous Driving Data Labeling", description: "Answer questions about correct labeling for autonomous vehicle perception systems.", category: "AI Training Tasks", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  // Sentence Arrangement
  { title: "Logical Text Ordering", description: "Arrange scrambled sentences and identify the correct logical sequence.", category: "Sentence Arrangement", reward: 0.15, estimatedMinutes: 5, timeLimitSeconds: 300, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Paragraph Coherence Tasks", description: "Identify correct paragraph structures and transitional logic in written passages.", category: "Sentence Arrangement", reward: 0.25, estimatedMinutes: 8, timeLimitSeconds: 420, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Advanced Text Sequencing", description: "Arrange complex multi-step arguments, historical sequences, and process descriptions.", category: "Sentence Arrangement", reward: 0.40, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "hard", minLevel: 2, questionCount: 7, cooldownHours: 48 },
  { title: "Business Writing Structure", description: "Identify correct structural components and logical flow in professional business writing.", category: "Sentence Arrangement", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  // Product Review Analysis
  { title: "Review Authenticity Check", description: "Distinguish genuine product reviews from fake, bot-generated, or incentivized ones.", category: "Product Review Analysis", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Sentiment & Usefulness Rating", description: "Rate product reviews for sentiment accuracy and informational usefulness to buyers.", category: "Product Review Analysis", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Fraud Detection in Reviews", description: "Identify coordinated review attacks, rating manipulation, and suspicious review patterns.", category: "Product Review Analysis", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "E-commerce Review Moderation", description: "Apply platform review moderation guidelines to accept or reject product reviews.", category: "Product Review Analysis", reward: 0.35, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  // Data Annotation
  { title: "Image Annotation Principles", description: "Apply correct image annotation techniques for machine learning model training.", category: "Data Annotation", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Text Span Annotation", description: "Correctly identify and label text spans for named entity and relation extraction.", category: "Data Annotation", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Video & Audio Annotation", description: "Demonstrate knowledge of temporal annotation for video and speech recognition datasets.", category: "Data Annotation", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Annotation Quality Control", description: "Apply inter-annotator agreement and quality audit principles to annotation projects.", category: "Data Annotation", reward: 0.60, estimatedMinutes: 15, timeLimitSeconds: 720, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Medical Imaging Annotation", description: "Answer questions about specialized annotation standards for healthcare AI datasets.", category: "Data Annotation", reward: 0.45, estimatedMinutes: 11, timeLimitSeconds: 540, difficulty: "medium", minLevel: 2, questionCount: 7, cooldownHours: 24 },
  // Surveys
  { title: "Survey Sampling Methods", description: "Demonstrate knowledge of correct sampling techniques used in survey research.", category: "Surveys", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Survey Bias Identification", description: "Identify and explain different types of bias that affect survey results.", category: "Surveys", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Statistical Analysis of Survey Data", description: "Apply statistical reasoning to interpret survey results and sample representativeness.", category: "Surveys", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Market Research Survey Design", description: "Evaluate market research surveys for methodological validity and reliability.", category: "Surveys", reward: 0.40, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
  // Video Analysis
  { title: "Video Content Classification", description: "Classify video content by genre, purpose, and topic based on descriptions and metadata.", category: "Video Analysis", reward: 0.20, estimatedMinutes: 6, timeLimitSeconds: 360, difficulty: "easy", minLevel: 1, questionCount: 5, cooldownHours: 24 },
  { title: "Video Quality Assessment", description: "Evaluate video quality metrics including frame rate, resolution, and encoding standards.", category: "Video Analysis", reward: 0.30, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 6, cooldownHours: 24 },
  { title: "Misinformation Detection in Video", description: "Identify misinformation techniques, deepfakes, and manipulative content in video descriptions.", category: "Video Analysis", reward: 0.50, estimatedMinutes: 12, timeLimitSeconds: 600, difficulty: "hard", minLevel: 2, questionCount: 8, cooldownHours: 48 },
  { title: "Educational Video Evaluation", description: "Assess instructional design quality and accessibility standards in educational videos.", category: "Video Analysis", reward: 0.40, estimatedMinutes: 10, timeLimitSeconds: 480, difficulty: "medium", minLevel: 2, questionCount: 7, cooldownHours: 24 },
  { title: "Video Content Moderation", description: "Apply platform community standards to determine appropriate content classification.", category: "Video Analysis", reward: 0.35, estimatedMinutes: 9, timeLimitSeconds: 450, difficulty: "medium", minLevel: 1, questionCount: 7, cooldownHours: 24 },
];

async function seedTasksIfNeeded() {
  try {
    const existing = await db.select({ id: tasksTable.id }).from(tasksTable)
      .where(eq(tasksTable.category, "Data Categorization"));
    if (existing.length > 0) return;
    for (const seed of TASK_SEEDS) {
      await db.insert(tasksTable).values({
        ...seed,
        taskType: "standard",
        instructions: CATEGORY_DESCRIPTIONS[seed.category] ?? seed.description,
        isActive: true,
      });
    }
  } catch (_) { /* silently skip if table doesn't exist yet */ }
}
seedTasksIfNeeded();

// ─── GET /tasks/categories ────────────────────────────────────────────────────

router.get("/tasks/categories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));
    const map: Record<string, { count: number; totalReward: number; maxReward: number }> = {};
    for (const t of tasks) {
      if (!map[t.category]) map[t.category] = { count: 0, totalReward: 0, maxReward: 0 };
      map[t.category].count++;
      map[t.category].totalReward += t.reward;
      if (t.reward > map[t.category].maxReward) map[t.category].maxReward = t.reward;
    }
    const totalInBank = Object.fromEntries(
      Object.keys(QUESTION_BANK).map(k => [k, QUESTION_BANK[k].length])
    );
    res.json(Object.entries(map).map(([name, v]) => ({
      name,
      count: v.count,
      totalReward: v.totalReward,
      maxReward: v.maxReward,
      description: CATEGORY_DESCRIPTIONS[name] ?? "",
      questionPoolSize: totalInBank[name] ?? 0,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /tasks ───────────────────────────────────────────────────────────────

router.get("/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category } = req.query as { category?: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));

    // Check cooldowns: get last passed attempt per task
    const recentAttempts = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.status, "passed")));
    const lastPassedAt: Record<number, Date> = {};
    for (const a of recentAttempts) {
      const prev = lastPassedAt[a.taskId];
      const ts = a.completedAt ? new Date(a.completedAt) : new Date(a.startedAt);
      if (!prev || ts > prev) lastPassedAt[a.taskId] = ts;
    }

    let tasks = allTasks.filter(t => t.minLevel <= user.level);
    if (category) tasks = tasks.filter(t => t.category === category);

    const now = Date.now();
    res.json(tasks.map(t => {
      const lastPassed = lastPassedAt[t.id];
      const cooldownMs = (t.cooldownHours ?? 24) * 3600_000;
      const onCooldown = lastPassed ? (now - lastPassed.getTime()) < cooldownMs : false;
      const cooldownEndsAt = lastPassed && onCooldown ? new Date(lastPassed.getTime() + cooldownMs).toISOString() : null;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        instructions: t.instructions,
        category: t.category,
        reward: t.reward,
        estimatedMinutes: t.estimatedMinutes,
        timeLimitSeconds: t.timeLimitSeconds,
        difficulty: t.difficulty,
        minLevel: t.minLevel,
        questionCount: t.questionCount,
        cooldownHours: t.cooldownHours,
        completionCount: t.completionCount,
        isActive: t.isActive,
        onCooldown,
        cooldownEndsAt,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /tasks/history ───────────────────────────────────────────────────────

router.get("/tasks/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const attempts = await db.select().from(taskAttemptsTable)
      .where(eq(taskAttemptsTable.userId, req.userId!))
      .orderBy(desc(taskAttemptsTable.startedAt))
      .limit(50);

    const taskIds = [...new Set(attempts.map(a => a.taskId))];
    const taskMap: Record<number, { title: string; category: string; reward: number }> = {};
    if (taskIds.length > 0) {
      const taskRows = await db.select().from(tasksTable)
        .where(eq(tasksTable.id, taskIds[0])); // simplified — get all
      for (const row of await db.select().from(tasksTable)) {
        taskMap[row.id] = { title: row.title, category: row.category, reward: row.reward };
      }
    }

    res.json(attempts.map(a => ({
      id: a.id,
      taskId: a.taskId,
      taskTitle: taskMap[a.taskId]?.title ?? "Unknown Task",
      taskCategory: taskMap[a.taskId]?.category ?? "",
      status: a.status,
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctAnswers: a.correctAnswers,
      rewardEarned: a.status === "passed" ? (taskMap[a.taskId]?.reward ?? 0) : 0,
      timeSpent: a.timeSpent,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /tasks/:id ───────────────────────────────────────────────────────────

router.get("/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/start ────────────────────────────────────────────────────

router.post("/tasks/:id/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task || !task.isActive) { res.status(404).json({ error: "Task not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

    // Starter (level 1) cap: $200 total earned maximum
    if (user.level === 1 && user.totalEarned >= 200) {
      res.status(403).json({
        error: "You've reached the $200 Starter limit. Upgrade your membership to keep earning unlimited rewards.",
        starterLimitReached: true,
      }); return;
    }

    if (task.minLevel > user.level) {
      res.status(403).json({ error: `This task requires ${getLevelName(task.minLevel)} level or above.` }); return;
    }

    // Cooldown check
    const lastPassed = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.taskId, id), eq(taskAttemptsTable.status, "passed")))
      .orderBy(desc(taskAttemptsTable.completedAt))
      .limit(1);
    if (lastPassed.length > 0) {
      const passedAt = lastPassed[0].completedAt ? new Date(lastPassed[0].completedAt) : new Date(lastPassed[0].startedAt);
      const cooldownMs = (task.cooldownHours ?? 24) * 3600_000;
      if (Date.now() - passedAt.getTime() < cooldownMs) {
        const endsAt = new Date(passedAt.getTime() + cooldownMs);
        res.status(400).json({ error: `Task on cooldown. Available again at ${endsAt.toLocaleString()}.`, onCooldown: true, cooldownEndsAt: endsAt.toISOString() }); return;
      }
    }

    // Cancel any in-progress attempt for this task
    await db.update(taskAttemptsTable).set({ status: "failed" })
      .where(and(eq(taskAttemptsTable.userId, req.userId!), eq(taskAttemptsTable.taskId, id), eq(taskAttemptsTable.status, "in_progress")));

    // Pick random questions from question bank
    const questionCount = task.questionCount ?? 5;
    const questions = getRandomQuestions(task.category, questionCount);
    if (questions.length === 0) {
      res.status(500).json({ error: "No questions available for this task category." }); return;
    }

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const ua = req.headers["user-agent"] ?? "";

    // Store attempt with full question data (including correct answers) server-side
    const [attempt] = await db.insert(taskAttemptsTable).values({
      userId: req.userId!,
      taskId: id,
      status: "in_progress",
      totalQuestions: questions.length,
      questionsSnapshot: questions as any,
      ipAddress: ip,
      userAgent: ua,
    }).returning();

    // Return questions WITHOUT correct answers
    const clientQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
    }));

    res.json({
      attemptId: attempt.id,
      timeLimitSeconds: task.timeLimitSeconds,
      questions: clientQuestions,
      totalQuestions: questions.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/submit ───────────────────────────────────────────────────

router.post("/tasks/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const { attemptId, answers, timeSpent } = req.body as {
      attemptId: number;
      answers: Array<{ questionId: string; answer: string }>;
      timeSpent?: number;
    };

    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    // Load the attempt — must belong to this user
    const [attempt] = await db.select().from(taskAttemptsTable)
      .where(and(eq(taskAttemptsTable.id, attemptId), eq(taskAttemptsTable.userId, req.userId!)));
    if (!attempt) { res.status(404).json({ error: "Attempt not found" }); return; }
    if (attempt.status !== "in_progress") { res.status(400).json({ error: "Attempt already completed" }); return; }

    // Validate time limit
    if (task.timeLimitSeconds) {
      const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000;
      if (elapsed > task.timeLimitSeconds + 60) {
        await db.update(taskAttemptsTable).set({ status: "timed_out", completedAt: new Date(), timeSpent: Math.round(elapsed) })
          .where(eq(taskAttemptsTable.id, attemptId));
        res.status(400).json({ error: "Time limit exceeded. Task expired.", timedOut: true }); return;
      }
    }

    // Anti-cheat: minimum time check (too fast = suspicious)
    const spentMs = Date.now() - new Date(attempt.startedAt).getTime();
    const minMs = (attempt.totalQuestions ?? 1) * 3000; // at least 3s per question
    const flagged = spentMs < minMs;
    const flagReason = flagged ? `Submitted too quickly (${Math.round(spentMs / 1000)}s for ${attempt.totalQuestions} questions)` : null;

    // Score the answers against stored correct answers
    const snapshot = (attempt.questionsSnapshot as any[]) ?? [];
    const answerMap: Record<string, string> = {};
    for (const a of answers) answerMap[a.questionId] = a.answer;

    let correctCount = 0;
    const gradedAnswers = snapshot.map((q: any) => {
      const submitted = answerMap[q.id] ?? "";
      const correct = submitted === q.correctAnswer;
      if (correct) correctCount++;
      return { questionId: q.id, answer: submitted, correct };
    });

    const score = snapshot.length > 0 ? Math.round((correctCount / snapshot.length) * 100) : 0;
    const passed = score === 100; // 100% accuracy required

    await db.update(taskAttemptsTable).set({
      status: passed ? "passed" : "failed",
      score,
      correctAnswers: correctCount,
      submittedAnswers: gradedAnswers as any,
      timeSpent: timeSpent ?? Math.round(spentMs / 1000),
      completedAt: new Date(),
      flagged,
      flagReason,
    }).where(eq(taskAttemptsTable.id, attemptId));

    if (!passed) {
      res.json({
        passed: false,
        score,
        correctAnswers: correctCount,
        totalQuestions: snapshot.length,
        message: `You got ${correctCount}/${snapshot.length} correct. All questions must be answered correctly to earn a reward.`,
        rewardEarned: 0,
      });
      return;
    }

    // Award reward
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const reward = task.reward;
    const newBalance = user.balance + reward;
    const newTotalEarned = user.totalEarned + reward;
    const newTaskEarnings = user.totalTaskEarnings + reward;
    const newCompleted = user.tasksCompleted + 1;

    let newLevel = user.level;
    if (newTotalEarned >= 5000) newLevel = 7;
    else if (newTotalEarned >= 2000) newLevel = 6;
    else if (newTotalEarned >= 1000) newLevel = 5;
    else if (newTotalEarned >= 500) newLevel = 4;
    else if (newTotalEarned >= 200) newLevel = 3;
    else if (newTotalEarned >= 50) newLevel = 2;

    await db.update(usersTable).set({
      balance: newBalance,
      tasksCompleted: newCompleted,
      totalEarned: newTotalEarned,
      totalTaskEarnings: newTaskEarnings,
      level: newLevel,
    }).where(eq(usersTable.id, req.userId!));

    await db.update(tasksTable).set({ completionCount: task.completionCount + 1 }).where(eq(tasksTable.id, id));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "earning",
      amount: reward,
      status: "completed",
      description: `Completed: ${task.title}`,
    });

    if (newLevel > user.level) {
      await db.insert(notificationsTable).values({
        userId: req.userId!,
        type: "level_up",
        title: "Level Up!",
        message: `Congratulations! You've reached ${getLevelName(newLevel)} level.`,
      });
    }

    // Also mark in legacy userTasksTable for backward compat
    const [existing] = await db.select().from(userTasksTable)
      .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    if (!existing) {
      await db.insert(userTasksTable).values({ userId: req.userId!, taskId: id, status: "completed", completedAt: new Date() });
    } else {
      await db.update(userTasksTable).set({ status: "completed", completedAt: new Date() })
        .where(and(eq(userTasksTable.userId, req.userId!), eq(userTasksTable.taskId, id)));
    }

    res.json({
      passed: true,
      score: 100,
      correctAnswers: correctCount,
      totalQuestions: snapshot.length,
      message: `Perfect score! You earned $${reward.toFixed(2)} for completing ${task.title}!`,
      rewardEarned: reward,
      newBalance,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /tasks/:id/complete (legacy – kept for backward compat) ─────────────

router.post("/tasks/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  res.status(400).json({ error: "Please use the new task submission flow (POST /tasks/:id/submit)." });
});

// ─── POST /tasks/daily-checkin (UNCHANGED) ────────────────────────────────────

router.post("/tasks/daily-checkin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const now = new Date();
    if (user.lastCheckIn) {
      const lastDate = new Date(user.lastCheckIn);
      const sameDay = lastDate.toDateString() === now.toDateString();
      if (sameDay) { res.status(400).json({ error: "Already checked in today" }); return; }
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = user.lastCheckIn && new Date(user.lastCheckIn).toDateString() === yesterday.toDateString();
    const streak = wasYesterday ? user.streakDays + 1 : 1;
    const reward = user.level === 1 ? 0.15 : Math.min(0.5 + (streak - 1) * 0.1, 2.0);

    await db.update(usersTable).set({
      balance: user.balance + reward,
      totalBonusEarnings: user.totalBonusEarnings + reward,
      totalEarned: user.totalEarned + reward,
      lastCheckIn: now,
      streakDays: streak,
    }).where(eq(usersTable.id, req.userId!));

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "bonus",
      amount: reward,
      status: "completed",
      description: `Daily check-in (Day ${streak} streak)`,
    });

    res.json({ success: true, rewardEarned: reward, streakDays: streak, message: `Day ${streak} streak! Earned $${reward.toFixed(2)}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
