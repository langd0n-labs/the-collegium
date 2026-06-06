# The Collegium — Operating Guide

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

## Build spec

`the-collegium-build-prompt.md` is the canonical build specification. Read it
before doing any implementation work. The other `the-collegium-*.md` files are
architecture and naming context — useful background, not directives.

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
