CREATE TABLE IF NOT EXISTS task_feed_sources (
  id serial PRIMARY KEY,
  name text NOT NULL,
  feed_url text NOT NULL,
  license_name text NOT NULL,
  license_url text NOT NULL,
  allowed_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  reuse_rights_confirmed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_sync_status text NOT NULL DEFAULT 'never',
  last_sync_message text,
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_feed_sources_feed_url_uq
  ON task_feed_sources(feed_url);
CREATE INDEX IF NOT EXISTS task_feed_sources_active_idx
  ON task_feed_sources(is_active);

CREATE TABLE IF NOT EXISTS task_feed_imports (
  id serial PRIMARY KEY,
  source_id integer NOT NULL REFERENCES task_feed_sources(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  instructions text NOT NULL,
  category text NOT NULL,
  estimated_minutes integer NOT NULL,
  source_url text NOT NULL,
  source_name_snapshot text NOT NULL,
  license_name_snapshot text NOT NULL,
  license_url_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  published_task_id integer REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_feed_imports_source_external_id_uq
  ON task_feed_imports(source_id, external_id);
CREATE INDEX IF NOT EXISTS task_feed_imports_status_created_idx
  ON task_feed_imports(status, created_at);
CREATE INDEX IF NOT EXISTS task_feed_imports_source_idx
  ON task_feed_imports(source_id);
