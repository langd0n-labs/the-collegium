# The Collegium

Lightweight event-driven multi-agent scaffold for Slack, Redis Streams, and Node.js/TypeScript.

## Services

- `ingress`: Slack Socket Mode client. Publishes Slack channel messages to `collegium:stream:[channel_id]` and posts `collegium:outbound` messages back into Slack threads.
- `syllabus-fellow` / `assessment-fellow`: generic `PersonaWorker` containers configured from a Collegium manifest.
- `foundry`: stateless worker that blocks on `foundry:commission:[channel_id]`, executes localized workspace commissions, and publishes completion messages to `collegium:outbound`.
- `redis`: message broker.

## Setup

```bash
cp .env.example .env
```

Fill in Slack credentials and channel IDs in `.env`. Do not commit `.env`.
Create operator-local `personas/` and `skills/` files referenced by `collegia/ds100.yaml`;
those directories are intentionally gitignored.

```bash
npm install
npm run build
docker compose up --build
```

## Commission Format

Fellows can delegate work by including a marker in their generated response:

```text
COMMISSION: {"description":"Create a short artifact","capability":"shell","command":"printf 'hello\n' > hello.txt"}
```

The Fellow strips the structured payload from Slack output and pushes it to `foundry:commission:[channel_id]`.
