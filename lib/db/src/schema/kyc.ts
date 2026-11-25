import { pgTable, serial, integer, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const kycSubmissionsTable = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  country: text("country").notNull(),
  nationality: text("nationality"),
  phoneNumber: text("phone_number").notNull(),
  nationalId: text("national_id").notNull(),
  submissionMethod: text("submission_method").notNull().default("didit"),
  documentType: text("document_type"),
  frontIdUrl: text("front_id_url"),
  backIdUrl: text("back_id_url"),
  selfieImageUrl: text("selfie_image_url"),
  selfieVideoUrl: text("selfie_video_url"),
  faceMatchScore: real("face_match_score"),
  kycStatus: text("kyc_status").notNull().default("pending_submission"),
  rejectionReason: text("rejection_reason"),
  diditSessionId: text("didit_session_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by"),
});

export const kycUploadCleanupRunsTable = pgTable("kyc_upload_cleanup_runs", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  adminId: integer("admin_id").notNull(),
  cutoff: timestamp("cutoff", { withTimezone: true }).notNull(),
  mode: text("mode").notNull(),
  scanned: integer("scanned").notNull(),
  olderThanCutoff: integer("older_than_cutoff").notNull(),
  referenced: integer("referenced").notNull(),
  eligible: integer("eligible").notNull(),
  deleted: integer("deleted").notNull(),
  pages: integer("pages").notNull(),
  hasMore: boolean("has_more").notNull(),
});
