// ─────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────

export type RoomStatus =
  | 'waiting'
  | 'starting'
  | 'in_session'
  | 'verdict'
  | 'reveal'
  | 'finished'

export type Role =
  | 'defendant'
  | 'defense_attorney'
  | 'prosecutor'
  | 'judge'
  | 'deputy'
  | 'witness'

export type VerdictValue  = 'guilty' | 'innocent'
export type EventType     = 'statement' | 'question' | 'objection' | 'system'

// ─────────────────────────────────────────────
// DB Row Types
// ─────────────────────────────────────────────

export interface Profile {
  id:         string
  username:   string
  avatar_url: string | null
  created_at: string
}

export interface GameRoom {
  id:                       string
  room_code:                string
  host_id:                  string
  case_id:                  string | null
  status:                   RoomStatus
  current_session:          number
  session_ends_at:          string | null
  session_duration_seconds: number
  max_players:              number
  created_at:               string
  updated_at:               string
}

export interface RoomPlayer {
  id:        string
  room_id:   string
  player_id: string
  role:      Role | null
  is_ready:  boolean
  is_host:   boolean
  joined_at: string
  profiles?: Pick<Profile, 'username' | 'avatar_url'>
}


export interface ActiveRoomMembership {
  room_id: string
  is_host: boolean
  role: Role | null
  game_rooms: Pick<GameRoom, 'id' | 'status' | 'current_session' | 'room_code'> | null
}

export interface RoleCard {
  id:            string
  room_id:       string
  player_id:     string
  role:          Role
  private_info:  string
  win_condition: string
  knows_truth:   boolean
}

export interface PublicCaseInfo {
  id:             string
  title:          string
  category:       string
  difficulty:     number
  min_players:    number
  max_players:    number
  public_summary: string
  public_facts:   string[]
}

export interface GameEvent {
  id:          string
  room_id:     string
  player_id:   string | null
  event_type:  EventType
  session_num: number
  content:     string
  created_at:  string
  profiles?:   Pick<Profile, 'username'>
}

export interface VerdictRow {
  id:                 string
  room_id:            string
  judge_id:           string
  verdict:            VerdictValue
  actual_verdict?:    VerdictValue | null
  hidden_truth?:      string | null
  judge_was_correct?: boolean | null
  submitted_at:       string
}

export interface GameResult {
  id:        string
  room_id:   string
  player_id: string
  role:      Role
  did_win:   boolean
  reason:    string
  profiles?: Pick<Profile, 'username'>
}

// ─────────────────────────────────────────────
// UI / Constants
// ─────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  defendant:         'المتهم',
  defense_attorney:  'محامي الدفاع',
  prosecutor:        'محامي الادعاء',
  judge:             'القاضي',
  deputy:            'النائب',
  witness:           'الشاهد',
}

export const ROLE_EMOJI: Record<Role, string> = {
  defendant:         '🔒',
  defense_attorney:  '🛡️',
  prosecutor:        '⚔️',
  judge:             '⚖️',
  deputy:            '📋',
  witness:           '👁️',
}

export const ROLE_COLOR_CLASS: Record<Role, string> = {
  defendant:         'role-defendant',
  defense_attorney:  'role-defense_attorney',
  prosecutor:        'role-prosecutor',
  judge:             'role-judge',
  deputy:            'role-deputy',
  witness:           'role-witness',
}

export const ROLE_ACCENT: Record<Role, string> = {
  defendant:         '#8B1A1A',
  defense_attorney:  '#1A508B',
  prosecutor:        '#8B641A',
  judge:             '#5A1A8B',
  deputy:            '#1A785A',
  witness:           '#1A8278',
}

export const CATEGORY_LABELS: Record<string, string> = {
  murder:  'جريمة قتل',
  fraud:   'احتيال',
  theft:   'سرقة',
  assault: 'اعتداء',
  other:   'أخرى',
}

export const SESSION_LABELS: Record<number, string> = {
  1: 'جلسة الاستماع الأولى',
  2: 'جلسة المرافعات',
  3: 'جلسة الخلاصة',
}
