# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DirtyPlay is a Texas Hold'em poker game with skill card mechanics and a suspicion/heat system. The stack is a Go WebSocket server + vanilla JS web client. A Godot 4 client exists in `client/` but is not the primary focus.

## Commands

### Server
```bash
cd server
go mod download
go run cmd/server/main.go          # Dev (serves web client from ../web/)
go build -o bin/server cmd/server/main.go && ./bin/server  # Production
go test ./...                      # All Go unit tests
go test ./internal/game/...        # Package-specific tests
```

### Web Client
No build step. Served statically by the Go server at `http://localhost:8080`. Open browser after starting the server.

### E2E / Playwright
```bash
npm install
npm run verify:skills              # Playwright skill coverage verification
```

## Architecture

The server is event-driven and organized under `server/internal/`:

- **`ws/`** — WebSocket hub and client management. Each browser connection becomes a `Client`.
- **`game/`** — Core game engine:
  - `room.go` (~1500 lines): The main game loop (`select` on event channel + 1s ticker). Owns the phase state machine: `waiting → dealing → preflop → flop → turn → river → showdown → repeat`. All action validation and hand progression live here.
  - `room_manager.go`: Room creation, player join/disconnect, bot slot filling.
  - `bot_logic.go`: Bot AI — `botContext()` scores hand strength/position/pressure, `chooseBotAction()` picks fold/check/call/raise, `chooseBotSkill()` picks skills strategically.
  - `view_builder.go`: Builds per-player `GameStateMsg` — applies skill effects (bluff, mist, peek) and hides opponents' hole cards.
  - `state.go`, `player.go`, `pot.go`: Data structures.
- **`poker/`** — Card/deck/hand evaluation. `evaluator.go` brute-forces 5-card combos from 7 cards.
- **`skill/`** — Skill definitions (peek/bluff/mist/swap/counter), effects storage, heat tracking.
- **`protocol/`** — Shared message types for the WebSocket JSON protocol.

### WebSocket Protocol

Client→Server: `join`, `action` (fold/check/call/raise/all-in), `use_skill`, `ready`

Server→Client: `game_state` (full per-player view), `action_request` (whose turn, valid actions), `skill_effect`, `error`

### Skill / Heat System

5 skills: **peek** (15 heat), **bluff** (20), **mist** (25), **swap** (30), **counter** (5 passive).
Heat ≥ 70 warns other players; ≥ 100 locks all skills. Decays −10 per hand.

## Coding Conventions

- Go: `gofmt`, `PascalCase` exports, `camelCase` locals, lowercase package names.
- JSON fields: `snake_case`, aligned with `server/internal/protocol/types.go`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
