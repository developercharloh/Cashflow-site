ALTER TABLE users
  ADD COLUMN IF NOT EXISTS task_package text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS task_package_purchased_at timestamptz;

-- Existing paid members keep task access when the new package flow replaces
-- the old membership checkout. Their previous tier could not be reconstructed.
UPDATE users
SET task_package = 'legacy',
    task_package_purchased_at = COALESCE(task_package_purchased_at, updated_at, created_at)
WHERE membership_purchased = true
  AND task_package = 'free';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS deadline_hours integer NOT NULL DEFAULT 72;

CREATE TABLE IF NOT EXISTS task_bids (
  id serial PRIMARY KEY,
  task_id integer NOT NULL REFERENCES tasks(id),
  user_id integer NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by integer REFERENCES users(id),
  bid_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_bids_task_user_unique
  ON task_bids (task_id, user_id);
CREATE INDEX IF NOT EXISTS task_bids_task_status_idx
  ON task_bids (task_id, status);
CREATE INDEX IF NOT EXISTS task_bids_user_status_idx
  ON task_bids (user_id, status);

ALTER TABLE task_submissions
  ADD COLUMN IF NOT EXISTS bid_id integer REFERENCES task_bids(id);
