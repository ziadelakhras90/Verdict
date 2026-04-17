-- Tighten direct client inserts into game_events so expired / stale session writes are rejected.

DROP POLICY IF EXISTS "member_can_insert_event" ON game_events;

CREATE POLICY "member_can_insert_event" ON game_events
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND room_id IN (
      SELECT rp.room_id
      FROM room_players rp
      JOIN game_rooms gr ON gr.id = rp.room_id
      WHERE rp.player_id = auth.uid()
        AND COALESCE(rp.role, '') <> 'judge'
        AND gr.status = 'in_session'
        AND gr.current_session = session_num
        AND gr.session_ends_at IS NOT NULL
        AND gr.session_ends_at > now()
    )
  );
