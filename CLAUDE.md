# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vendetto is a Discord bot for the "Everlasting Vendetta" WoW TBC Classic Anniversary guild. Built with TypeScript, discord.js v14, PostgreSQL, and Supabase. Runs on Node 22, deployed via Docker or PM2.

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # run in dev mode (ts-node-dev with hot reload)
pnpm build            # compile TS → dist/ (tsc + tsc-alias + copy .sql/.md assets)
pnpm start            # run compiled output (node dist/index.js)
pnpm compile          # type-check only (tsc --noEmit)
pnpm test             # run all tests (jest)
pnpm test -- --testPathPattern="pattern"  # run a single test file
```

Docker: `docker compose up --build`

## Architecture

Clean/hexagonal architecture with strict layer separation:

- **`src/domain/`** — Pure business logic, no external dependencies. Delivery personalization (Mustache templates), raid models.
- **`src/application/`** — Use cases, command definitions, event handlers, workflow engine, and **ports** (outbound interfaces for repositories/services).
- **`src/delivery/`** — Inbound adapters: Discord slash command handlers, event listeners.
- **`src/infrastructure/`** — Outbound adapters: Discord API, PostgreSQL repositories, Supabase client, Ollama AI, EV guild API, discord-player music adapter.
- **`src/main/`** — Bootstrap: `app.ts` (startup orchestration), `di-container.ts` (manual constructor-injection wiring), command/event/workflow registration.
- **`src/seeds/`** — Seed data.
- **`src/supabase/`** — Supabase-specific config.
- **`src/util/`** — Shared utilities (rate-limited thread pool, file resource loader).
- **`src/tests/`** — Jest tests with mocks.

### Dependency flow

`main → application → domain` (inward only). Infrastructure implements application ports. Never import infrastructure from domain/application — use ports.

### Key wiring

`di-container.ts` manually constructs all dependencies — no IoC framework. Two separate containers: one for commands/events, one for workflows.

## Adding Features

### New command
1. Create command class implementing `DiscordCommand` with a `SlashCommandBuilder` and `execute()` method.
2. Register it in `di-container.ts` and add to the command registry in `start-discord-bot.ts`.

### New workflow (scheduled task)
1. Extend `WorkflowWithSchedule` and use decorators:
   - `@WorkflowName("name")` — identifier
   - `@Schedule("cron-expr", { isRecurring: true })` — cron timing
   - `@Step("step-name", order)` — execution steps
   - `@Retryable({ maxRetries, delayMs, backoffStrategy })` — retry with fixed/exponential backoff
2. Wire in `di-container.ts`, register in `start-workflows.ts`.

### New event
Implement `DiscordEvent` (name, once flag, execute), register in `EventsRegistry`.

### New repository
Define a port interface in `src/application/ports/outbound/database/`, implement in `src/infrastructure/persistance/repositories/`. SQL queries are stored as `.sql` files loaded at runtime via `readResourceFile()`.

## Important Patterns

- **Path alias**: `@/` maps to `src/` (tsconfig paths + tsc-alias + jest moduleNameMapper).
- **Timezone**: All cron schedules and timestamps use `Europe/Madrid`.
- **Rate limiting**: `RateLimitedThreadPool` (5 tasks per 5 seconds) wraps Discord API calls to avoid rate limits.
- **Feature flags**: `GuildFeaturePolicyService` gates features per guild (free vs premium tiers).
- **Discord ID resolution**: Must UNION `oauth_providers` + `discord_members` tables, never query just one.
- **SQL as files**: Repository queries live as `.sql` files next to their adapter, copied to `dist/` at build time.
- **Music**: discord-player + YoutubeiExtractor, requires ffmpeg in PATH or `FFMPEG_PATH` env var.

## Testing

Jest with `ts-jest` (ESM preset). Tests use standard Jest mocks — no test database. The `pg-mem` dependency exists but typical tests mock repository ports directly.

```bash
pnpm test -- --testPathPattern="personalize"  # run specific test
```

## Environment

Required env vars: `DISCORD_TOKEN`, `CLIENT_ID`, `POSTGRES_*` (host/port/database/user/password/ssl), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EV_API_BASE_URL`, `EV_API_TOKEN`, `NODE_ENV`, `PORT`.

Optional: `FFMPEG_PATH`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `TBC_CURRENT_PHASE`.
