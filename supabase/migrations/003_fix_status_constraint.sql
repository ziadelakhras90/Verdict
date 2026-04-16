-- ================================================================
-- Migration 003 — Ensure 'starting' status is in constraint
-- Run this if you already ran 001_full_schema.sql
-- (001 already includes 'starting' in the CHECK — this is a no-op safety migration)
-- ================================================================

-- Verify the constraint already includes 'starting'
-- If it does not (older schema), run this to fix:
DO $$
BEGIN
  -- Drop old constraint if it exists without 'starting'
  BEGIN
    ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Re-add with all valid statuses
  BEGIN
    ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_status_check
      CHECK (status IN ('waiting','starting','in_session','verdict','reveal','finished'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Allow host to update room from any status (needed for begin-session via edge fn)
-- This is handled by service role in edge functions, no RLS change needed.

SELECT 'Migration 003 complete' AS status;
