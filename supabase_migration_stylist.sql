-- Adds the column that records whether an outfit came from Milli (AI) or the
-- deterministic rules engine. Safe to re-run; every statement uses IF NOT EXISTS
-- semantics so the script is idempotent in the Supabase SQL editor.
--
-- HOW TO RUN (once per environment):
--   1. Supabase dashboard → your project → SQL Editor → New query.
--   2. Paste this entire file and click "Run".
--   3. You should see "Success. No rows returned". Re-running prints the same.
--
-- This file does NOT touch the `items` table or the wardrobe-items bucket —
-- those come from `supabase_schema.sql`, which must run first.

ALTER TABLE outfits
  ADD COLUMN IF NOT EXISTS generated_by TEXT NOT NULL DEFAULT 'rules';

-- Re-attach the CHECK constraint idempotently. We have to drop+add (rather
-- than CREATE IF NOT EXISTS) because PostgreSQL has no `ADD CONSTRAINT IF
-- NOT EXISTS` syntax. Wrapped in DO so the script never errors on re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outfits_generated_by_check'
      AND conrelid = 'outfits'::regclass
  ) THEN
    ALTER TABLE outfits
      ADD CONSTRAINT outfits_generated_by_check
      CHECK (generated_by IN ('ai', 'rules'));
  END IF;
END $$;
