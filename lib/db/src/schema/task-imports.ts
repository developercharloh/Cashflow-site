import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tasksTable } from "./tasks";

export const taskFeedSourcesTable = pgTable("task_feed_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull(),
  licenseName: text("license_name").notNull(),
  licenseUrl: text("license_url").notNull(),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull().default([]),
  reuseRightsConfirmedAt: timestamp("reuse_rights_confirmed_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status").notNull().default("never"),
  lastSyncMessage: text("last_sync_message"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  feedUrlUnique: uniqueIndex("task_feed_sources_feed_url_uq").on(table.feedUrl),
  activeIndex: index("task_feed_sources_active_idx").on(table.isActive),
}));

export const taskFeedImportsTable = pgTable("task_feed_imports", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => taskFeedSourcesTable.id, { onDelete: "restrict" }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  category: text("category").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceNameSnapshot: text("source_name_snapshot").notNull(),
  licenseNameSnapshot: text("license_name_snapshot").notNull(),
  licenseUrlSnapshot: text("license_url_snapshot").notNull(),
  status: text("status").notNull().default("pending"),
  publishedTaskId: integer("published_task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  sourceExternalIdUnique: uniqueIndex("task_feed_imports_source_external_id_uq").on(table.sourceId, table.externalId),
  statusCreatedIndex: index("task_feed_imports_status_created_idx").on(table.status, table.createdAt),
  sourceIndex: index("task_feed_imports_source_idx").on(table.sourceId),
}));

export const insertTaskFeedSourceSchema = createInsertSchema(taskFeedSourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskFeedImportSchema = createInsertSchema(taskFeedImportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type TaskFeedSource = typeof taskFeedSourcesTable.$inferSelect;
export type InsertTaskFeedSource = z.infer<typeof insertTaskFeedSourceSchema>;
export type TaskFeedImport = typeof taskFeedImportsTable.$inferSelect;
export type InsertTaskFeedImport = z.infer<typeof insertTaskFeedImportSchema>;
