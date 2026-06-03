import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const kycSubmissionsTable = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  country: text("country").notNull(),
  phoneNumber: text("phone_number").notNull(),
  nationalId: text("national_id").notNull(),
  frontIdUrl: text("front_id_url"),
  backIdUrl: text("back_id_url"),
  selfieVideoUrl: text("selfie_video_url"),
  faceMatchScore: real("face_match_score"),
  kycStatus: text("kyc_status").notNull().default("pending_submission"),
  rejectionReason: text("rejection_reason"),
  diditSessionId: text("didit_session_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by"),
});
