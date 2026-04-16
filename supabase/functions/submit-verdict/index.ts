// supabase/functions/submit-verdict/index.ts
// Judge submits final verdict; function computes winners, stores summary, and finishes the game.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type VerdictValue = 'guilty' | 'innocent'
type Role = 'defendant' | 'defense_attorney' | 'prosecutor' | 'judge' | 'deputy' | 'witness'

function computeWin(
  role: Role,
  finalVerdict: VerdictValue,
  actualVerdict: VerdictValue,
): { did_win: boolean; reason: string } {
  const match = finalVerdict === actualVerdict
  switch (role) {
    case 'defendant':
      return {
        did_win: finalVerdict === 'innocent',
        reason: finalVerdict === 'innocent' ? 'صدر الحكم ببراءته' : 'صدر الحكم بإدانته',
      }
    case 'defense_attorney':
      return {
        did_win: finalVerdict === 'innocent',
        reason: finalVerdict === 'innocent' ? 'نجح في إثبات البراءة' : 'فشل في الدفاع عن موكله',
      }
    case 'prosecutor':
      return {
        did_win: finalVerdict === 'guilty',
        reason: finalVerdict === 'guilty' ? 'نجح في إثبات الإدانة' : 'فشل في إثبات التهمة',
      }
    case 'judge':
      return {
        did_win: match,
        reason: match ? 'حكمه طابق الحقيقة الفعلية' : 'حكمه لم يطابق الحقيقة',
      }
    case 'deputy':
      return {
        did_win: match,
        reason: match ? 'ساعد في الوصول إلى الحقيقة' : 'لم يؤدِّ إلى النتيجة الصحيحة',
      }
    case 'witness':
      return {
        did_win: match,
        reason: match ? 'شهادته ساعدت في الوصول للحقيقة' : 'شهادته لم تؤدِّ للحقيقة',
      }
    default:
      return { did_win: false, reason: 'دور غير معروف' }
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

    const { roomId, verdict } = await req.json()
    if (!roomId) throw new Error('roomId is required')
    if (!['guilty', 'innocent'].includes(verdict)) throw new Error('Invalid verdict')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('id, status, current_session, session_ends_at, case_templates(actual_verdict, hidden_truth)')
      .eq('id', roomId)
      .single()
    if (roomErr || !room) throw new Error('Room not found')
    if (!['verdict', 'finished'].includes(room.status)) throw new Error('Room not in verdict phase')

    const { data: judgeMembership, error: judgeErr } = await admin
      .from('room_players')
      .select('player_id, role')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()
    if (judgeErr || !judgeMembership || judgeMembership.role !== 'judge') {
      throw new Error('Only the judge can submit the verdict')
    }

    const ct = room.case_templates as { actual_verdict: VerdictValue; hidden_truth: string } | null
    if (!ct) throw new Error('Case data missing for room')

    const actualVerdict = ct.actual_verdict
    const judgeWasCorrect = verdict === actualVerdict

    // Idempotent path for already finished rooms
    if (room.status === 'finished') {
      const { data: existingVerdict } = await admin
        .from('verdicts')
        .select('*')
        .eq('room_id', roomId)
        .single()

      const { data: existingResults } = await admin
        .from('game_results')
        .select('*, profiles(username)')
        .eq('room_id', roomId)

      return new Response(JSON.stringify({
        ok: true,
        verdict: existingVerdict,
        results: existingResults ?? [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: players, error: playersErr } = await admin
      .from('room_players')
      .select('player_id, role')
      .eq('room_id', roomId)
    if (playersErr || !players) throw new Error('Failed to fetch players')

    const results = players
      .filter((p) => p.role)
      .map((p) => {
        const { did_win, reason } = computeWin(p.role as Role, verdict as VerdictValue, actualVerdict)
        return { room_id: roomId, player_id: p.player_id, role: p.role, did_win, reason }
      })

    const { error: verdictUpsertErr } = await admin
      .from('verdicts')
      .upsert({
        room_id: roomId,
        judge_id: user.id,
        verdict,
        actual_verdict: actualVerdict,
        hidden_truth: ct.hidden_truth,
        judge_was_correct: judgeWasCorrect,
      }, { onConflict: 'room_id' })
    if (verdictUpsertErr) throw new Error('Failed to save verdict: ' + verdictUpsertErr.message)

    const { error: resultsErr } = await admin
      .from('game_results')
      .upsert(results, { onConflict: 'room_id,player_id' })
    if (resultsErr) throw new Error('Failed to save results: ' + resultsErr.message)

    await admin.from('game_events').insert({
      room_id: roomId,
      player_id: null,
      event_type: 'system',
      session_num: room.current_session || 3,
      content: `القاضي حكم بأن المتهم ${verdict === 'innocent' ? 'بريء' : 'مذنب'}`,
    })

    const { error: finishErr } = await admin
      .from('game_rooms')
      .update({ status: 'finished', session_ends_at: null })
      .eq('id', roomId)
    if (finishErr) throw new Error('Failed to finish room: ' + finishErr.message)

    const { data: finalResults } = await admin
      .from('game_results')
      .select('*, profiles(username)')
      .eq('room_id', roomId)

    const { data: finalVerdict } = await admin
      .from('verdicts')
      .select('*')
      .eq('room_id', roomId)
      .single()

    return new Response(JSON.stringify({
      ok: true,
      verdict: finalVerdict,
      results: finalResults ?? [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[submit-verdict]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
