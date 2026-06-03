import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  country: text("country"),
  avatar: text("avatar"),
  level: integer("level").notNull().default(1),
  balance: real("balance").notNull().default(0),
  pendingEarnings: real("pending_earnings").notNull().default(0),
  totalWithdrawn: real("total_withdrawn").notNull().default(0),
  totalEarned: real("total_earned").notNull().default(0),
  totalReferralEarnings: real("total_referral_earnings").notNull().default(0),
  totalTaskEarnings: real("total_task_earnings").notNull().default(0),
  totalBonusEarnings: real("total_bonus_earnings").notNull().default(0),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: integer("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerifyCode: text("email_verify_code"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires", { withTimezone: true }),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  quizCompleted: boolean("quiz_completed").notNull().default(false),
  welcomeGiftClaimed: boolean("welcome_gift_claimed").notNull().default(false),
  transcriptionMinutes: real("transcription_minutes").notNull().default(0),
  membershipPurchased: boolean("membership_purchased").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
