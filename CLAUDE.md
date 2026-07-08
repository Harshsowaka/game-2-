# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm start        # Run production build
npm run lint     # ESLint via next lint
```

There are no tests configured.

## Architecture

Next.js 14 App Router project (TypeScript). No database — the leaderboard is in-memory and resets on server restart.

**Routes:**
- `app/page.tsx` — Home/lobby: player name entry, create/join game by code, weekly leaderboard display (polls `/api/leaderboard` every 5s)
- `app/game/page.tsx` — Game page: reads `?code=` from URL and `playerName` from `localStorage`; manages game state machine (`lobby → playing → roundend`)
- `app/api/leaderboard/route.js` — GET returns sorted scores; POST adds/increments a player's score (in-memory array, not persisted)

**Components:**
- `components/GameCanvas.tsx` — HTML5 canvas with mouse/touch drawing. Uses `forwardRef`. Renders at 2× resolution for retina. Only active when `isActive` prop is true (drawers only). Calls `onDraw(dataURL)` on each stroke — the hook exists but the caller currently passes `() => {}` (Socket.io sync not yet wired).
- `components/LeaderboardWidget.tsx` — In-game score display, takes a `scores` object (`{playerName: number}`).

**Game logic (`lib/gameLogic.ts`):**
- `WORDS` — categorized word lists (easy/medium/hard)
- `SCORING` — all point values and timing constants
- `GAME_CONFIG` — player min/max limits
- `getRandomWord(difficulty)`, `generateGameCode()`, `calculateScore(guessTime, roundDuration)` — pure utilities

## Current State (Mock/Stub)

- **Multiplayer is not real-time yet.** The game page uses hardcoded mock players in the lobby and local-only state. Socket.io is installed (`socket.io` + `socket.io-client`) but not wired up.
- The game page has its own inline `startRound` word picker using a hardcoded array — it should use `getRandomWord()` from `lib/gameLogic.ts` instead.
- `generateGameCode()` is duplicated in `app/page.tsx` and `lib/gameLogic.ts`.
- Scores accumulate only in React state (`scores` object in `game/page.tsx`) and are never POSTed to `/api/leaderboard`.

## Customization Points

- **Word lists:** `lib/gameLogic.ts` → `WORDS`
- **Scoring:** `lib/gameLogic.ts` → `SCORING`
- **Theme colors:** `tailwind.config.js` → `theme.extend.colors` (`primary`, `secondary`, `accent`)
