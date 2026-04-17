-- ================================================================
-- COURTHOUSE GAME — Full Database Schema
-- Run this entire file in Supabase SQL Editor
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'player_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. CASE TEMPLATES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'other',
  difficulty       INT  DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  min_players      INT  NOT NULL DEFAULT 4,
  max_players      INT  NOT NULL DEFAULT 8,
  public_summary   TEXT NOT NULL,
  public_facts     JSONB NOT NULL DEFAULT '[]',
  hidden_truth     TEXT NOT NULL,
  actual_verdict   TEXT NOT NULL CHECK (actual_verdict IN ('guilty','innocent')),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_templates_active
  ON case_templates(is_active, min_players, max_players);

ALTER TABLE case_templates ENABLE ROW LEVEL SECURITY;
-- Clients NEVER read the raw table — use the view below
CREATE POLICY "no_direct_client_select" ON case_templates FOR SELECT USING (false);

-- Safe public view — hides hidden_truth and actual_verdict
CREATE OR REPLACE VIEW public_case_info AS
  SELECT id, title, category, difficulty, min_players, max_players,
         public_summary, public_facts
  FROM case_templates
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────
-- 3. CASE ROLE CARDS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_role_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES case_templates(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN (
                  'defendant','defense_attorney','prosecutor',
                  'judge','deputy','witness'
                )),
  private_info  TEXT NOT NULL,
  win_condition TEXT NOT NULL,
  hints         JSONB DEFAULT '{}',
  UNIQUE (case_id, role)
);

ALTER TABLE case_role_cards ENABLE ROW LEVEL SECURITY;
-- Clients NEVER read role cards — only Edge Functions via service role
CREATE POLICY "no_client_select_cards" ON case_role_cards FOR SELECT USING (false);

-- ─────────────────────────────────────────────────────────────
-- 4. GAME ROOMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_rooms (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code                TEXT NOT NULL UNIQUE,
  host_id                  UUID NOT NULL REFERENCES profiles(id),
  case_id                  UUID REFERENCES case_templates(id),
  status                   TEXT NOT NULL DEFAULT 'waiting'
                           CHECK (status IN ('waiting','starting','in_session','verdict','reveal','finished')),
  current_session          INT  NOT NULL DEFAULT 0,
  session_ends_at          TIMESTAMPTZ,
  session_duration_seconds INT  NOT NULL DEFAULT 180,
  max_players              INT  NOT NULL DEFAULT 6,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_code   ON game_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status) WHERE status <> 'finished';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS game_rooms_updated_at ON game_rooms;
CREATE TRIGGER game_rooms_updated_at
  BEFORE UPDATE ON game_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_member_can_select" ON game_rooms
  FOR SELECT USING (
    id IN (SELECT room_id FROM room_players WHERE player_id = auth.uid())
  );

CREATE POLICY "authenticated_can_create_room" ON game_rooms
  FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "host_can_update_room" ON game_rooms
  FOR UPDATE USING (host_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. ROOM PLAYERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES profiles(id),
  role        TEXT CHECK (role IN (
                'defendant','defense_attorney','prosecutor',
                'judge','deputy','witness'
              )),
  is_ready    BOOLEAN NOT NULL DEFAULT false,
  is_host     BOOLEAN NOT NULL DEFAULT false,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_room_players_room   ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_player ON room_players(player_id);

ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_members_can_select" ON room_players
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM room_players rp WHERE rp.player_id = auth.uid())
  );

CREATE POLICY "player_can_join" ON room_players
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "player_can_update_own" ON room_players
  FOR UPDATE USING (player_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 6. PLAYER ROLE DATA  ← most security-critical table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_role_data (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES profiles(id),
  role          TEXT NOT NULL,
  private_info  TEXT NOT NULL,
  win_condition TEXT NOT NULL,
  knows_truth   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (room_id, player_id)
);

ALTER TABLE player_role_data ENABLE ROW LEVEL SECURITY;

-- Each player sees ONLY their own card — nothing else
CREATE POLICY "player_sees_only_own_card" ON player_role_data
  FOR SELECT USING (player_id = auth.uid());

-- No client-side writes ever
CREATE POLICY "no_client_insert" ON player_role_data FOR INSERT WITH CHECK (false);
CREATE POLICY "no_client_update" ON player_role_data FOR UPDATE USING (false);
CREATE POLICY "no_client_delete" ON player_role_data FOR DELETE USING (false);

-- ─────────────────────────────────────────────────────────────
-- 7. GAME EVENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES profiles(id),
  event_type  TEXT NOT NULL CHECK (event_type IN ('statement','question','objection','system')),
  session_num INT  NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_events_room_session
  ON game_events(room_id, session_num, created_at);

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_members_read_events" ON game_events
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM room_players WHERE player_id = auth.uid())
  );

CREATE POLICY "member_can_insert_event" ON game_events
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND room_id IN (
      SELECT rp.room_id FROM room_players rp
      JOIN game_rooms gr ON gr.id = rp.room_id
      WHERE rp.player_id = auth.uid()
        AND gr.status = 'in_session'
    )
  );

-- Allow system events (player_id = null) via service role — no client policy needed

-- ─────────────────────────────────────────────────────────────
-- 8. VERDICTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verdicts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL UNIQUE REFERENCES game_rooms(id) ON DELETE CASCADE,
  judge_id     UUID NOT NULL REFERENCES profiles(id),
  verdict      TEXT NOT NULL CHECK (verdict IN ('guilty','innocent')),
  submitted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "judge_can_submit_verdict" ON verdicts
  FOR INSERT WITH CHECK (
    judge_id = auth.uid()
    AND room_id IN (
      SELECT rp.room_id FROM room_players rp
      JOIN game_rooms gr ON gr.id = rp.room_id
      WHERE rp.player_id = auth.uid()
        AND rp.role = 'judge'
        AND gr.status IN ('in_session','verdict')
    )
  );

CREATE POLICY "room_members_read_verdict" ON verdicts
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM room_players WHERE player_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 9. GAME RESULTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES profiles(id),
  role        TEXT NOT NULL,
  did_win     BOOLEAN NOT NULL,
  reason      TEXT,
  UNIQUE (room_id, player_id)
);

ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Only visible after reveal/finished
CREATE POLICY "results_visible_after_reveal" ON game_results
  FOR SELECT USING (
    room_id IN (
      SELECT rp.room_id FROM room_players rp
      JOIN game_rooms gr ON gr.id = rp.room_id
      WHERE rp.player_id = auth.uid()
        AND gr.status IN ('reveal','finished')
    )
  );

CREATE POLICY "no_client_insert_results" ON game_results FOR INSERT WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────
-- 10. UTILITY FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- Generate unique 6-char room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = code);
    attempts := attempts + 1;
    IF attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique room code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 11. SAMPLE CASE DATA  (1 sample case, 4-6 players)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  case_id UUID;
BEGIN
  INSERT INTO case_templates (title, category, difficulty, min_players, max_players,
    public_summary, public_facts, hidden_truth, actual_verdict, is_active)
  VALUES (
    'السكرتيرة المختفية',
    'murder',
    2,
    4,
    6,
    'اختفت سكرتيرة شركة كبرى في ظروف غامضة إثر خلاف مع مديرها. آخر من رآها كان المدير نفسه، وهو الذي أبلغ عن اختفائها بعد ثلاثة أيام.',
    '["آخر من رآها هو المدير في مكتبه مساء الثلاثاء", "وُجد حذاؤها بالقرب من النهر", "كانت قد أبلغت عائلتها بنيتها الاستقالة", "لم تُعثر على جثة حتى الآن", "كانت تحمل وثائق مالية حساسة"]',
    'قتلها المدير خشية أن تُسرِّب وثائق تثبت تلاعبه في حسابات الشركة. دفن الجثة في مستودع مهجور خارج المدينة.',
    'guilty',
    true
  )
  RETURNING id INTO case_id;

  INSERT INTO case_role_cards (case_id, role, private_info, win_condition, hints) VALUES
  (case_id, 'defendant',
   'أنت أحمد السيد، مدير الشركة. قتلتها فعلاً لأنها كانت على وشك تسريب وثائق الفساد المالي. لديك alibi مزيف: تدّعي أنك كنت في اجتماع في فرع القاهرة — لكن الاجتماع أُلغي ولا شهود حقيقيون. تصرّف بثقة ولا تبدُ مرتبكاً.',
   'اجعل القاضي يصدر حكم البراءة. استخدم الـ alibi وشكِّك في الأدلة.',
   '{"alibi": "اجتماع مزيف في فرع القاهرة", "weakness": "الاجتماع أُلغي — تجنب ذكر الشهود بالاسم"}'),

  (case_id, 'defense_attorney',
   'أنت محامي الدفاع. موكلك مذنب فعلاً لكن لا يعلم أحد ذلك سواك وسواه. ركِّز على: غياب الجثة، ضعف الأدلة الظرفية، وإمكانية أن تكون قد اختفت طوعاً. زعزع مصداقية الشهود.',
   'يصدر الحكم ببراءة المتهم.',
   '{"strategy": "الشك يُفسَّر لصالح المتهم — لا جثة ولا سلاح جريمة"}'),

  (case_id, 'prosecutor',
   'أنت محامي الادعاء. لديك الحقائق العامة فقط: آخر من رآها كان المدير، حذاؤها عند النهر، ولم يبدُ عليه حزن حقيقي. ليس لديك أدلة دامغة لكن السلوك مريب.',
   'يصدر الحكم بإدانة المتهم.',
   '{"angle": "السلوك البارد وعدم التعاون مع التحقيق"}'),

  (case_id, 'judge',
   'أنت القاضي. ليس لديك أي معلومات مسبقة عن القضية سوى ما يُقدَّم في الجلسات. أدر الجلسات بنزاهة، واستمع لجميع الأطراف قبل الحكم.',
   'يطابق حكمك الحقيقة الفعلية — المتهم مذنب.',
   null),

  (case_id, 'witness',
   'أنت زميل المرحومة في العمل. رأيتها تبكي قبل يوم من اختفائها وسمعتها تقول "لن أصمت أكثر". لاحظتَ أن المدير كان عصبياً جداً تلك الأيام. أجب بصدق فقط عمّا رأيته.',
   'تُسهم شهادتك في الوصول للحقيقة.',
   '{"facts": ["رأيتها تبكي", "سمعتها تقول لن أصمت", "المدير كان عصبياً"]}'),

  (case_id, 'deputy',
   'أنت نائب القاضي. مهمتك تنظيم الجلسات وتدوين الملاحظات. يمكنك طرح أسئلة توضيحية على الشهود. التزم بالنظام.',
   'يصدر الحكم الصحيح بفضل إدارة جيدة للجلسات.',
   null);

END $$;
