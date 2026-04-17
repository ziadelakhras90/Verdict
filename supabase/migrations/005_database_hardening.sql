-- ================================================================
-- Migration 005 — Database hardening and invariant enforcement
-- ================================================================

-- Basic sanity bounds for rooms and cases
DO $$
BEGIN
  BEGIN
    ALTER TABLE game_rooms
      ADD CONSTRAINT game_rooms_current_session_nonnegative
      CHECK (current_session >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE game_rooms
      ADD CONSTRAINT game_rooms_max_players_range
      CHECK (max_players BETWEEN 4 AND 8);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE game_rooms
      ADD CONSTRAINT game_rooms_session_duration_range
      CHECK (session_duration_seconds BETWEEN 30 AND 900);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE case_templates
      ADD CONSTRAINT case_templates_player_bounds_valid
      CHECK (
        min_players >= 4
        AND max_players <= 8
        AND max_players >= min_players
      );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Helpful indexes for common room-scoped fetches
CREATE INDEX IF NOT EXISTS idx_player_role_data_room_player
  ON player_role_data(room_id, player_id);

CREATE INDEX IF NOT EXISTS idx_game_results_room_player
  ON game_results(room_id, player_id);

CREATE INDEX IF NOT EXISTS idx_room_players_room_host
  ON room_players(room_id, is_host);

-- Enforce only one host membership per room
CREATE UNIQUE INDEX IF NOT EXISTS uniq_room_players_one_host_per_room
  ON room_players(room_id)
  WHERE is_host = true;

-- Enforce at most one judge per room once roles are assigned
CREATE UNIQUE INDEX IF NOT EXISTS uniq_room_players_one_judge_per_room
  ON room_players(room_id)
  WHERE role = 'judge';

-- Tie role cards / results to real room membership so orphaned rows cannot exist
DO $$
BEGIN
  BEGIN
    ALTER TABLE player_role_data
      ADD CONSTRAINT player_role_data_room_player_fk
      FOREIGN KEY (room_id, player_id)
      REFERENCES room_players(room_id, player_id)
      ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE game_results
      ADD CONSTRAINT game_results_room_player_fk
      FOREIGN KEY (room_id, player_id)
      REFERENCES room_players(room_id, player_id)
      ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Keep host membership aligned with game_rooms.host_id after direct room updates.
CREATE OR REPLACE FUNCTION sync_room_host_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE room_players
  SET is_host = false
  WHERE room_id = NEW.id
    AND is_host = true
    AND player_id <> NEW.host_id;

  UPDATE room_players
  SET is_host = true
  WHERE room_id = NEW.id
    AND player_id = NEW.host_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_room_host_membership_on_room_update ON game_rooms;
CREATE TRIGGER sync_room_host_membership_on_room_update
  AFTER UPDATE OF host_id ON game_rooms
  FOR EACH ROW
  WHEN (OLD.host_id IS DISTINCT FROM NEW.host_id)
  EXECUTE FUNCTION sync_room_host_membership();

-- Make host transfer work cleanly with the single-host invariant.
CREATE OR REPLACE FUNCTION transfer_room_host(
  p_room_id UUID,
  p_new_host_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current_host UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT host_id INTO v_current_host
  FROM game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_current_host <> v_uid THEN
    RAISE EXCEPTION 'Only host can transfer host ownership';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id AND player_id = p_new_host_player_id
  ) THEN
    RAISE EXCEPTION 'New host must already be in the room';
  END IF;

  UPDATE room_players
  SET is_host = false
  WHERE room_id = p_room_id
    AND is_host = true;

  UPDATE room_players
  SET is_host = true
  WHERE room_id = p_room_id
    AND player_id = p_new_host_player_id;

  UPDATE game_rooms
  SET host_id = p_new_host_player_id
  WHERE id = p_room_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION transfer_room_host(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_room_host(UUID, UUID) TO authenticated;

SELECT 'Migration 005 complete' AS status;
