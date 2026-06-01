import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions"),
  category: text("category").notNull(),
  taskType: text("task_type").notNull().default("standard"), // standard | transcription
  reward: real("reward").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  timeLimitSeconds: integer("time_limit_seconds"), // null = no timer
  minutesCost: real("minutes_cost"), // for transcription tasks
  difficulty: text("difficulty").notNull().default("easy"),
  minLevel: integer("min_level").notNull().default(1),
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

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const insertUserTaskSchema = createInsertSchema(userTasksTable).omit({ id: true });
export type InsertUserTask = z.infer<typeof insertUserTaskSchema>;
export type UserTask = typeof userTasksTable.$inferSelect;
