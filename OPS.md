# The Collegium — Operating Guide

Read the shared agent conventions in
`~/loc-areas/meta/ai-control-plane/meta-claude.md` before proceeding — it is
the repo-canonical, machine-independent source for cross-project rules
(worktree discipline, GitHub identity, secrets handling, etc.). The rules
below extend or override it where they conflict.

## What this project is

The Collegium is a multi-tenant, event-driven AI system that organizes expert
personas into topic-specific communities called **Collegia**. Users interact
through Slack; personas communicate through Redis Streams. The system is
deliberately decentralized — no orchestrator, no DAG — just pub/sub and
activation logic.

Core components:
- **Ingress Engine** — Slack Socket Mode client; routes messages into Redis
- **Fellow Worker** — persona subscriber; activates on keywords, calls LLM, publishes responses
- **Commission Interceptor** — detects structured `COMMISSION: {...}` markers in Fellow output
- **Foundry Worker** — executes localized shell commands from commission queue

## Before doing research

Check `docs/comparisons.md` first. It records systems we have already evaluated (MetaClaw,
Ona, LangGraph, CrewAI, AutoGen, and others) and explains why we made the design choices we
made. If your research question is "has anyone done X before" or "how does this compare to
Y," the answer may already be there. Add new comparisons when you find something worth
recording.

For deep historical/academic prior art, see `docs/research/prior-art-report.md`.

## Build spec

`the-collegium-build-prompt.md` is the canonical build specification. Read it
before doing any implementation work. The other `the-collegium-*.md` files are
architecture and naming context — useful background, not directives.

## Design-input notes (read on session start, and always before designing)

`../notes/` (sibling of this checkout, at `~/loc-projects/the-collegium/notes/`
— **outside this repo, never committed**) is where design inputs get dropped
as they're found — real worked cases, Fellow candidates, architecture
corrections — by whichever agent or session happens to hit something
relevant. It is not curated on a schedule; treat every file in it as live
input, not an archive.

**Read everything in it at session start, and always before any Collegium
design or roster work** — not just the files that sound relevant by name.
These are concrete, evidence-grounded inputs (real cases the operator has
already reasoned through), not speculation — weight them accordingly against
`docs/comparisons.md` and the build spec.

Because it's outside the repo, it may contain real names, personal context,
and specifics that must never end up in a commit — see "Public repo rules"
below.

## Stack

- TypeScript / Node.js
- Slack SDK (Socket Mode)
- Redis Streams (`ioredis`)
- Docker Compose

## Public repo rules

This is a public GitHub repository. Everything committed is public.

- No personal data, real names, internal hostnames, or private file paths in commits
- No real secrets in the repo — `.env.example` only; never `.env`
- Describe changes in general technical terms in commit messages and PR bodies

## Environment / secrets

The system requires:
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` — Slack Socket Mode credentials
- `REDIS_URL` — Redis connection string
- `LLM_API_BASE` — base URL for the API proxy (default: `http://localhost:8001/v1`)
- Per-Fellow: `ENV_CHANNEL_ID`, `ENV_ACTIVATION_KEYWORDS`

Always use `.env.example` as the template. Never commit real values.

## Notifications

**Blocked:**
```bash
~/bin/tg-notify "the-collegium agent blocked: <reason>" alerts
```

**Done:**
```bash
~/bin/tg-notify "the-collegium: <summary>. <link>" ambient
```
