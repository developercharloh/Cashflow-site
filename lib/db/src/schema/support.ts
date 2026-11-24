import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { z } from "zod/v4";

export const supportThreadsTable = pgTable("support_threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("support_threads_user_id_unique").on(table.userId),
  index("support_threads_updated_at_idx").on(table.updatedAt),
]);

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => supportThreadsTable.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(),
  authorUserId: integer("author_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("support_messages_thread_created_idx").on(table.threadId, table.createdAt),
]);

export const insertSupportThreadSchema = createInsertSchema(supportThreadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSupportMessageSchema = createInsertSchema(supportMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSupportThread = z.infer<typeof insertSupportThreadSchema>;
export type SupportThread = typeof supportThreadsTable.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
