# Testing Guide

This project now includes a lightweight automated test foundation focused on the highest-risk game-flow logic.

## Automated tests added

### Routing and game-flow unit tests
These tests validate the canonical room page resolution used to protect against:
- stale refreshes
- manual URL edits
- judge/player page mixups
- redirects after room status changes

Covered file:
- `src/lib/gameFlow.spec.ts`

Core logic under test:
- `getRoomRouteByStatus(...)`
- `getRoomPath(...)`
- `shouldRedirectToCanonicalRoomPage(...)`

## Commands

Install dependencies first:

```bash
npm install
```

Run tests once:

```bash
npm test
```

Run in watch mode:

```bash
npm run test:watch
```

## Added room synchronization coverage

The test suite now also covers pure helpers extracted from the realtime/polling reconciliation flow:
- `shouldIgnoreStaleFetch(...)`
- `shouldFetchCaseInfo(...)`
- `shouldClearCaseInfo(...)`
- `buildPlayerPresenceUpdate(...)`
- `shouldFallbackRefetchForDeletedPlayer(...)`
- `attachEventProfile(...)`

Covered file:
- `src/lib/roomSync.spec.ts`

## Recommended next automated test targets

### 1. Action-layer tests
Priority functions:
- `startGame(...)`
- `beginSession(...)`
- `advanceSession(...)`
- `submitVerdict(...)`
- `revealTruth(...)`

Focus on:
- loading state cleanup
- stale/idempotent response handling
- normalized error messages

### 2. Store synchronization tests
Covered file:
- `src/stores/roomStore.spec.ts`

Current coverage includes:
- duplicate event deduplication
- chronological event sorting
- room scoping behavior
- preserving state during same-room navigation
- resetting volatile state when switching rooms
- stable player ordering for `setPlayers(...)` and `upsertPlayer(...)`

### 3. End-to-end smoke tests
Once npm and browser tooling are available, cover this exact path:
1. create room
2. join with multiple players
3. start game
4. reveal role cards
5. session 1 -> 2 -> 3
6. submit verdict
7. reveal truth
8. show results
9. refresh one player mid-game and verify reconnection path

## Manual regression checklist

After every major change, verify:
- refresh from `Lobby`
- refresh from `RoleCard`
- refresh from `Session`
- refresh from `JudgePanel`
- refresh from `Verdict`
- refresh from `Reveal`
- refresh from `Results`
- late/stale retry on `start-game`
- late/stale retry on `advance-session`
- late/stale retry on `submit-verdict`
- late/stale retry on `reveal-truth`

## Important note

I could not execute `npm install` or `npm test` in the current environment because the package registry/authentication is still blocked here. The test files and configuration were added conservatively and should be run in your normal local/project environment.

## Added pure utility coverage

The test suite now also covers:
- `normalizeErrorMessage(...)` for string, `Error`, and API-shaped objects
- `getEdgeMutationState(...)` for idempotent/stale edge responses
- basic formatting helpers like `formatTimer(...)` and `timeAgo(...)`

This keeps duplicate-request handling testable without depending on live Supabase calls.

- `src/lib/edgeMutation.spec.ts`: يغطي رسائل وحالات `success / duplicate / stale_request` للـEdge Functions.
