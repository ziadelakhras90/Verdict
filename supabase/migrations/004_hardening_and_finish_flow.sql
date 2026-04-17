-- ================================================================
-- Migration 004 — Security hardening, atomic room ops, final finish flow
-- ================================================================

-- Verdict summary fields for finished-game screens
ALTER TABLE verdicts
  ADD COLUMN IF NOT EXISTS actual_verdict TEXT CHECK (actual_verdict IN ('guilty','innocent')),
  ADD COLUMN IF NOT EXISTS hidden_truth TEXT,
  ADD COLUMN IF NOT EXISTS judge_was_correct BOOLEAN;

-- Allow players to read usernames/avatar of users who share a room with them
DO $$
BEGIN
  CREATE POLICY "profiles_select_shared_room"
    ON profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM room_players me
        JOIN room_players other
          ON other.room_id = me.room_id
        WHERE me.player_id = auth.uid()
          AND other.player_id = profiles.id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Atomic create-room + host-membership function
CREATE OR REPLACE FUNCTION create_room_with_host(
  p_max_players INT DEFAULT 6,
  p_session_duration_seconds INT DEFAULT 180
)
RETURNS game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_room game_rooms%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO game_rooms (
    room_code,
    host_id,
    max_players,
    session_duration_seconds
  ) VALUES (
    generate_room_code(),
    v_uid,
    COALESCE(p_max_players, 6),
    COALESCE(p_session_duration_seconds, 180)
  )
  RETURNING * INTO v_room;

  INSERT INTO room_players (room_id, player_id, is_host, is_ready)
  VALUES (v_room.id, v_uid, true, false);

  RETURN v_room;
END;
$$;

REVOKE ALL ON FUNCTION create_room_with_host(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_room_with_host(INT, INT) TO authenticated;

-- Atomic join function with row locking to prevent overfilling rooms
CREATE OR REPLACE FUNCTION join_room_by_code(p_room_code TEXT)
RETURNS game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_room  game_rooms%ROWTYPE;
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO v_room
  FROM game_rooms
  WHERE room_code = UPPER(TRIM(p_room_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الغرفة غير موجودة';
  END IF;

  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'اللعبة بدأت بالفعل';
  END IF;

  IF EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = v_room.id AND player_id = v_uid
  ) THEN
    RETURN v_room;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM room_players
  WHERE room_id = v_room.id;

  IF v_count >= v_room.max_players THEN
    RAISE EXCEPTION 'الغرفة ممتلئة';
  END IF;

  INSERT INTO room_players (room_id, player_id, is_host, is_ready)
  VALUES (v_room.id, v_uid, false, false);

  RETURN v_room;
END;
$$;

REVOKE ALL ON FUNCTION join_room_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_room_by_code(TEXT) TO authenticated;

-- Atomic host transfer function
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
  SET is_host = CASE WHEN player_id = p_new_host_player_id THEN true ELSE false END
  WHERE room_id = p_room_id
    AND player_id IN (v_uid, p_new_host_player_id);

  UPDATE game_rooms
  SET host_id = p_new_host_player_id
  WHERE id = p_room_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION transfer_room_host(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_room_host(UUID, UUID) TO authenticated;
