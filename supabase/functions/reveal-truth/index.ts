// supabase/functions/reveal-truth/index.ts
// Legacy helper retained for compatibility. If a room is already finished,
// it simply returns the stored summary and results.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type VerdictValue = 'guilty' | 'innocent'

type Role = 'defendant' | 'defense_attorney' | 'prosecutor' | 'judge' | 'deputy' | 'witness'

function computeWin(role: Role, finalVerdict: VerdictValue, actualVerdict: VerdictValue) {
  const match = finalVerdict === actualVerdict
  switch (role) {
    case 'defendant': return { did_win: finalVerdict === 'innocent', reason: finalVerdict === 'innocent' ? 'صدر الحكم ببراءته' : 'صدر الحكم بإدانته' }
    case 'defense_attorney': return { did_win: finalVerdict === 'innocent', reason: finalVerdict === 'innocent' ? 'نجح في إثبات البراءة' : 'فشل في الدفاع عن موكله' }
    case 'prosecutor': return { did_win: finalVerdict === 'guilty', reason: finalVerdict === 'guilty' ? 'نجح في إثبات الإدانة' : 'فشل في إثبات التهمة' }
    case 'judge': return { did_win: match, reason: match ? 'حكمه طابق الحقيقة الفعلية' : 'حكمه لم يطابق الحقيقة' }
    case 'deputy': return { did_win: match, reason: match ? 'ساعد في الوصول للحقيقة' : 'لم يؤدِّ إلى النتيجة الصحيحة' }
    case 'witness': return { did_win: match, reason: match ? 'شهادته ساعدت في الوصول للحقيقة' : 'شهادته لم تؤدِّ للحقيقة' }
    default: return { did_win: false, reason: 'دور غير معروف' }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const { roomId } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: membership } = await admin
      .from('room_players')
      .select('player_id')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()
    if (!membership) throw new Error('You are not a member of this room')

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('*, case_templates(actual_verdict, hidden_truth)')
      .eq('id', roomId)
      .single()
    if (roomErr || !room) throw new Error('Room not found')

    const { data: existingVerdict } = await admin
      .from('verdicts')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (room.status === 'finished' && existingVerdict?.actual_verdict) {
      const { data: existingResults } = await admin
        .from('game_results')
        .select('*, profiles(username)')
        .eq('room_id', roomId)

      return new Response(JSON.stringify({
        ok: true,
        actual_verdict: existingVerdict.actual_verdict,
        hidden_truth: existingVerdict.hidden_truth,
        results: existingResults ?? [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!['verdict', 'reveal'].includes(room.status)) throw new Error('Room not in verdict/reveal phase')
    if (room.host_id !== user.id) throw new Error('Only host can reveal truth')
    if (!existingVerdict?.verdict) throw new Error('No verdict submitted')

    const caseData = room.case_templates as { actual_verdict: VerdictValue; hidden_truth: string } | null
    if (!caseData) throw new Error('Case data missing')

    const { data: players, error: playersErr } = await admin
      .from('room_players').select('player_id, role').eq('room_id', roomId)
    if (playersErr || !players) throw new Error('Failed to fetch players')

    const results = players
      .filter((p) => p.role)
      .map((p) => {
        const { did_win, reason } = computeWin(p.role as Role, existingVerdict.verdict as VerdictValue, caseData.actual_verdict)
        return { room_id: roomId, player_id: p.player_id, role: p.role, did_win, reason }
      })

    await admin.from('game_results').upsert(results, { onConflict: 'room_id,player_id' })
    await admin.from('verdicts').update({
      actual_verdict: caseData.actual_verdict,
      hidden_truth: caseData.hidden_truth,
      judge_was_correct: existingVerdict.verdict === caseData.actual_verdict,
    }).eq('room_id', roomId)
    await admin.from('game_rooms').update({ status: 'finished', session_ends_at: null }).eq('id', roomId)

    return new Response(JSON.stringify({
      ok: true,
      actual_verdict: caseData.actual_verdict,
      hidden_truth: caseData.hidden_truth,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reveal-truth]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
