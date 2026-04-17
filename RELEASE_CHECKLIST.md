# Courthouse Game - Release Checklist

## 1) Database
- [ ] Run all migrations in order:
  - [ ] `001_full_schema.sql`
  - [ ] `002_more_cases.sql`
  - [ ] `003_fix_status_constraint.sql`
  - [ ] `004_hardening_and_finish_flow.sql`
  - [ ] `005_database_hardening.sql`
- [ ] Confirm there is exactly one host per room.
- [ ] Confirm there is at most one judge per room.
- [ ] Confirm `player_role_data` rows belong to real room members.
- [ ] Confirm `game_results` rows belong to real room members.

## 2) Edge Functions
Deploy all functions:
- [ ] `start-game`
- [ ] `begin-session`
- [ ] `advance-session`
- [ ] `submit-verdict`
- [ ] `reveal-truth`

## 3) Environment
- [ ] Set `VITE_SUPABASE_URL`
- [ ] Set `VITE_SUPABASE_ANON_KEY`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` for functions
- [ ] Verify Netlify environment variables match Supabase project

## 4) Manual Smoke Tests
### Room lifecycle
- [ ] Create room
- [ ] Join room from multiple browsers/devices
- [ ] Transfer host and verify only one host remains
- [ ] Refresh each client in lobby and confirm they recover correctly

### Game start
- [ ] Start game once successfully
- [ ] Double-click start button and verify the game does not start twice
- [ ] Retry start under lag and verify roles are not reassigned differently

### Role card / reconnect
- [ ] Refresh on role-card page and verify player returns to correct page
- [ ] Refresh from home/auth while room is active and verify resume works

### Session flow
- [ ] Send statement/question/objection in session
- [ ] Refresh during session and verify correct restore
- [ ] Confirm session composer resets when session number changes
- [ ] Let session timer expire and verify judge advances once only
- [ ] Trigger lag / repeated clicks and verify no double-advance happens

### Verdict / reveal / results
- [ ] Submit verdict once successfully
- [ ] Retry verdict request and verify idempotent handling
- [ ] Reveal truth once successfully
- [ ] Refresh during reveal and results and verify loading recovers
- [ ] Confirm results do not show before reveal data is ready

## 5) Failure-path Tests
- [ ] Disconnect network during a critical action and verify loading clears
- [ ] Reconnect after temporary failure and retry action successfully
- [ ] Verify toasts/messages are understandable for stale or duplicate requests

## 6) Launch Readiness
- [ ] `npm install` completes in the real environment
- [ ] `npm run build` succeeds
- [ ] All functions deployed to the same Supabase project
- [ ] RLS policies verified in production
- [ ] Case templates seeded as expected
- [ ] At least one full game tested end-to-end with 4-6 players

## High-priority follow-up work
- Add integration tests for edge-function idempotency.
- Add end-to-end multiplayer smoke tests.
- Add structured logging / trace IDs for critical room transitions.
- Consider server-side audit events for room state changes.
