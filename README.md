# The Collegium

An event-driven platform for coordinating communities of expertise and
artifact-producing automation. Topic-specific communities — **Collegia** — host
expert personas (**Fellows**) who observe a shared discussion, contribute on
relevance, and commission work from a decoupled execution tier (the **Foundry**).
Users interact through Slack; Fellows coordinate over Redis Streams. No central
orchestrator — just pub/sub and activation logic.

Built with Node.js / TypeScript, `@slack/bolt`, Redis Streams (`ioredis`), and
Docker / Podman Compose.

## Terminology

| Term | Meaning |
|------|---------|
| **The Collegium** | The platform itself. |
| **Collegium** | A topic-specific community of expertise (a course, a research area). |
| **Collegia** | The collection of all Collegium instances. |
| **Fellow** | An expert persona with a defined domain — observes the channel, contributes on relevance, and issues Commissions. |
| **Foundry** | The execution tier that fulfills Commissions and produces Artifacts. |
| **Forge** | A specialized execution capability within the Foundry (a PDF Forge, a Notebook Forge). |
| **Commission** | A request from a Fellow declaring *what* artifact is needed and its acceptance criteria — never *how* (see ADR-0002). |
| **Artifact** | A produced output: notebook, PDF, report, dataset, presentation, code package. |

This table supersedes the former standalone brand guide. **Avoid** "agent swarm,"
"autonomous employee," "digital coworker," and the legacy "god / dwarf"
vocabulary in code, config, and output.

## Architecture

The Collegium is the **event-driven realization of a blackboard model**:
specialists watch a shared space and act opportunistically, with a typed handoff
into a separate execution tier. The design decisions — and, deliberately, the
prior art showing this is a *synthesis* of established patterns rather than a
novel coordination architecture — are recorded as ADRs:

- **[ADR-0001](docs/decisions/0001-eda-choreography-over-dag.md)** — event-driven choreography over DAG orchestration (why no central planner).
- **[ADR-0002](docs/decisions/0002-commission-requirements-not-method.md)** — a Commission declares requirements, not method (the Contract-Net split).
- **[ADR-0003](docs/decisions/0003-control-and-cost-seams-in-v1.md)** — leave control & cost seams in v1; defer the mechanisms.
- **[ADR-0004](docs/decisions/0004-edge-is-a-port-filled-by-official-sdks.md)** — the edge is our port, filled by official platform SDKs.

## Prior art

This architecture recombines blackboard systems (HEARSAY-II / BB1), the Contract
Net Protocol, tuple-space / bus decoupling, and service choreography — it is not
a new coordination model, and is stronger for naming its lineage. The honest
analysis (and why the residual is a packaging question, not an invention) lives
in **[docs/research/prior-art-report.md](docs/research/prior-art-report.md)**.

## Services

- `ingress` — Slack Socket Mode client. Publishes channel messages to `collegium:stream:<channel_id>` and posts `collegium:outbound` messages back into Slack threads.
- `pedagogy-fellow` / `assessment-fellow` — generic `PersonaWorker` containers configured from a Collegium manifest.
- `forge` — constrained worker that blocks on `forge:commission:<channel_id>`, fulfills typed commissions, and publishes completion messages to `collegium:outbound`. Runs on an internal network with no inbound ports.
- `redis` — message bus / blackboard.

## Setup

```bash
cp .env.example .env
```

Fill in Slack credentials and channel IDs in `.env` (never commit `.env`). Create
operator-local `personas/` and `skills/` files referenced by `collegia/ds100.yaml`
— copy the shapes from `personas.example/` and `skills.example/`. Those runtime
directories are gitignored (content stays out of the public repo).

```bash
npm install
npm run build
podman compose up --build
```

## Commission format

A Fellow delegates work by including a marker in its generated response:

```text
COMMISSION: {"forge":"record","requirements":"Create a short artifact","acceptance_criteria":["Write one Markdown file"],"params":{"title":"Short Artifact","filename":"short-artifact.md","body":"hello"}}
```

The Fellow strips the structured payload from its Slack output and pushes it to
`forge:commission:<channel_id>`; the Forge fulfills it and returns an Artifact.
