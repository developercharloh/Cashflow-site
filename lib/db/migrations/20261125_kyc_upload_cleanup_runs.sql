CREATE TABLE IF NOT EXISTS "kyc_upload_cleanup_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "ran_at" timestamptz NOT NULL DEFAULT now(),
  "admin_id" integer NOT NULL,
  "cutoff" timestamptz NOT NULL,
  "mode" text NOT NULL,
  "scanned" integer NOT NULL,
  "older_than_cutoff" integer NOT NULL,
  "referenced" integer NOT NULL,
  "eligible" integer NOT NULL,
  "deleted" integer NOT NULL,
  "pages" integer NOT NULL,
  "has_more" boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS "kyc_upload_cleanup_runs_ran_at_idx"
  ON "kyc_upload_cleanup_runs" ("ran_at");
