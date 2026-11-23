ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS asset_url text,
  ADD COLUMN IF NOT EXISTS review_guide text;
