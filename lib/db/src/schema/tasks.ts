import { pgTable, text, serial, timestamp, boolean, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions"),
  category: text("category").notNull(),
  taskType: text("task_type").notNull().default("standard"),
  reward: real("reward").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  timeLimitSeconds: integer("time_limit_seconds"),
  difficulty: text("difficulty").notNull().default("easy"),
  minLevel: integer("min_level").notNull().default(1),
  questionCount: integer("question_count").notNull().default(5),
  cooldownHours: integer("cooldown_hours").notNull().default(24),
  isActive: boolean("is_active").notNull().default(true),
  completionCount: integer("completion_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userTasksTable = pgTable("user_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  status: text("status").notNull().default("started"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const taskAttemptsTable = pgTable("task_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  status: text("status").notNull().default("in_progress"), // in_progress | passed | failed | timed_out
  score: integer("score").notNull().default(0),            // 0-100
  totalQuestions: integer("total_questions").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  questionsSnapshot: jsonb("questions_snapshot"),          // [{id,question,options,correctAnswer}] stored server-side
  submittedAnswers: jsonb("submitted_answers"),            // [{questionId, answer}]
  timeSpent: integer("time_spent"),                        // seconds
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  flagged: boolean("flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const insertUserTaskSchema = createInsertSchema(userTasksTable).omit({ id: true });
export type InsertUserTask = z.infer<typeof insertUserTaskSchema>;
export type UserTask = typeof userTasksTable.$inferSelect;

export const insertTaskAttemptSchema = createInsertSchema(taskAttemptsTable).omit({ id: true });
export type InsertTaskAttempt = z.infer<typeof insertTaskAttemptSchema>;
export type TaskAttempt = typeof taskAttemptsTable.$inferSelect;
