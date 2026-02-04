# Repository Guidelines

## Project Structure & Module Organization
This repo contains a Godot client and a Go server.

- `client/` holds the Godot 4 project, scenes in `client/scenes/`, scripts in `client/scripts/`, and assets in `client/assets/`.
- `server/` is the Go backend. Entry point lives in `server/cmd/server/main.go`, with core logic under `server/internal/`.
- `docs/` contains design and technical documentation, including `docs/game_plan.md`.

## Build, Test, and Development Commands
Run server dependencies and start the backend:

```bash
cd server
go mod download
go run cmd/server/main.go
```

Build a production server binary:

```bash
cd server
go build -o bin/server cmd/server/main.go
./bin/server
```

Run the client locally:

- Open `client/project.godot` in Godot 4.3+ and press F5.

## Coding Style & Naming Conventions
- Go: follow `gofmt` conventions. Use `PascalCase` for exported identifiers and `camelCase` for locals. Keep files and packages in `lower_snake` or short lowercase names.
- GDScript: follow Godot defaults with tabs for indentation, `snake_case` for functions/variables, and keep signal names lowercase (see `client/scripts/autoload/network.gd`).
- Keep JSON fields `snake_case` and align with `server/internal/protocol/`.

## Testing Guidelines
There are no automated tests yet. When adding tests:

- Go tests should use `*_test.go` and run with `go test ./...`.
- Place unit tests next to the package they cover (e.g., `server/internal/game/`).

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits style, e.g., `feat: add room manager` or `fix: handle disconnect`.
- PRs should include a clear summary, testing notes, and screenshots for UI changes. Link related issues when applicable.

## Security & Configuration
- Do not commit secrets. Use local env files (e.g., `.env`, `.envrc`) for API keys and document required vars in the PR description.
