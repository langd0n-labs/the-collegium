# The Collegium — v1 Build Prompt (corrected)

> Supersedes `the-collegium-build-prompt.md` for the next build. That earlier
> prompt produced the current scaffold but baked in structural gaps: Fellows
> deaf to each other, no loop safety, and a Foundry that runs raw shell. This
> prompt extends the existing scaffold and fixes them.

## CONTEXT

Extend the existing repo (TypeScript, `@slack/bolt` + `ioredis` + Redis Streams +
docker-compose). **Do NOT start over, and do NOT pull in NanoClaw** — the scaffold
already does Slack Socket Mode + Redis Streams in ~570 lines. Read `OPS.md` and the
existing `src/` before changing anything.

System vocabulary is the Collegium brand guide: **Fellow / Foundry / Forge /
Commission / Artifact**. Do not introduce "God / Dwarf / Pantheon" naming into code,
config, or output.

## GOAL OF V1 — the only success criterion

Prove the loop end-to-end on real course content:

1. Two **Fellows** in one channel **deliberate** — they read each other's
   contributions, not just the human's.
2. The deliberation **terminates safely** (no infinite loop, no runaway cost).
3. A resolution **precipitates** into one **Commission**.
4. One **Forge** fulfills it and returns one real **Artifact** file.

Reuse existing assets; write as little new code as possible. A working narrow loop
beats a broad half-loop.

## CHANGES (in order — one commit each)

### 1. Config-driven personas (the manifest)

A collegium is declared by a YAML manifest, not by env-var soup:

```yaml
# collegia/ds100.yaml
channel_id: "${DS100_CHANNEL_ID}"
fellows:
  - name: "Pedagogy Lead"
    persona_file: "personas/pedagogy-lead.md"
    activation_keywords: ["lecture", "sequence", "concept", "scaffold"]
  - name: "Assessment Strategist"
    persona_file: "personas/assessment.md"
    activation_keywords: ["assessment", "exam", "grading", "rubric"]
forges:
  - name: "record"
    skill_files:
      - "skills/record.md"
```

**Concept note for the implementer:** a *Commission* declares **requirements and
acceptance criteria** — the *what* and *why* a Fellow needs ("a printable
practice exam covering joins, 8–10 questions, answer key included"). It does
**not** prescribe *how*. The *Forge* owns the method; a *Forge skill* is the
durable capability doc the Forge loads to meet the requirements. The manifest
mounts skills (capabilities), never commissions (instances). This is the
Contract Net split: the Fellow announces the need; the Forge decides how to
fulfill it.

- One generic `PersonaWorker` loads its identity + system prompt from the
  `persona_file` named in the manifest (mounted read-only). Kill per-Fellow
  identity-via-env.
- `personas/` and `skills/` are operator-populated and **gitignored** (course
  content; keep it out of the public repo).

### 2. Fellows hear each other  *(the core fix)*

- A Fellow's contribution publishes onto the channel **deliberation stream** that
  the other Fellows consume — in addition to `collegium:outbound`.
- A Fellow ignores its own messages and does not re-fire on a turn it already
  answered.

### 3. Loop safety — circuit breaker  *(MANDATORY, not optional)*

The Fellows now react to each other, so the system **can** loop forever. Because
the LLM calls run through Pro-account proxies, a runaway loop burns cost **and
risks getting the upstream accounts flagged for abuse.** v1 must not ship without:

- A per-thread **turn counter** in Redis. When replies in a `thread_ts` exceed a
  configurable cap (default 8), the deliberation halts and posts a single
  "deliberation depth reached" notice to `collegium:outbound`.
- A Fellow does not respond to a thread it is already mid-turn on (a short
  `thread_ts` lock so two Fellows don't stampede the same turn).

### 4. Arbitration seam  *(leave the seam; do not build the Provost yet)*

- Activation in v1 stays keyword-based (`includes()` is fine).
- BUT isolate the "should this Fellow speak now, and is it their turn?" decision
  behind one function/module, so a future **Provost** (semantic activation +
  turn arbitration) can replace it without touching the worker loop. Do not
  build the Provost in v1 — just make the seam clean.

### 5. Durable consumption

- Convert Fellow stream reads to Redis **consumer groups** (`XREADGROUP` + `XACK`)
  so a restarted Fellow resumes instead of skipping. Idempotent on stream id.
- Store thread history keyed by `thread_ts` (a per-thread list), not by scanning a
  capped `xrevrange` window.

### 6. Forge = constrained executor, not raw shell  *(safety fix)*

- A Commission names a **forge + typed params**; it never ships a shell string.
- A Forge is a generic worker that loads its instructions from the manifest's
  `skill_files` (reuse existing capability/convention markdown) and runs in a
  container on an **isolated network with no inbound**.
- V1 ships exactly **one** Forge. Start with the lightest skill that still
  writes a *real* file end-to-end; the heavier notebook/LaTeX skills (which drag
  in the autograder build chain, datasets, and validation) are a v2 concern.
- Reject any commission whose forge isn't in the manifest; post a refusal to
  `collegium:outbound`.

### 7. Scope — one topic, real content

- `docker-compose`: `redis`, `ingress`, **two** Fellows on `#ds100` chosen so they
  will actually disagree (Pedagogy Lead vs Assessment Strategist), **one** Forge.

## EXPLICITLY OUT OF SCOPE FOR V1 (do not build)

- Web UI / "Studio Dashboard" / dynamic tenant spawning / selling to others
- Multiple message brokers / hierarchical routing keys
- The Provost (semantic activation + turn arbitration) — leave the seam only
- Multiple topics — config supports it, but v1 ships one (`#ds100`)

## DELIVERY

- Commit on the existing branch, **one commit per numbered change** so the diff is
  teachable.
- Open a PR; post one `@codex` review comment.
- Public repo: no secrets (`.env.example` only), no personal paths, general
  technical language in commits and PR body.
