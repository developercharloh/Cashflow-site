CREATE TABLE IF NOT EXISTS "support_threads" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_threads_user_id_unique"
  ON "support_threads" ("user_id");
CREATE INDEX IF NOT EXISTS "support_threads_updated_at_idx"
  ON "support_threads" ("updated_at");

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "thread_id" integer NOT NULL REFERENCES "support_threads"("id") ON DELETE CASCADE,
  "author_type" text NOT NULL,
  "author_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_messages_thread_created_idx"
  ON "support_messages" ("thread_id", "created_at");
