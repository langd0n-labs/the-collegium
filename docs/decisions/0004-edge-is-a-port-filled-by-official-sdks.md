# ADR-0004: The edge is our port, filled by official platform SDKs

- **Status:** accepted
- **Date:** 2026-06-06
- **Deciders:** Langdon, Mimir

## Context

The Collegium talks to humans through a chat surface (Slack today) and to
itself through a blackboard (Redis Streams — a *separate* port, always Redis;
see the forthcoming blackboard-transport ADR). This ADR is only about the
**human edge**: ingress (messages in) and egress (messages out).

Two desires were in tension:

1. **"Use someone else's reliable component"** at the edge, rather than bespoke
   glue — the same principle that makes mocking the edge in tests honest.
2. **Add a platform later cheaply** — "if we want Discord, just go pick up that
   adapter."

The v1 scaffold wired `@slack/bolt` **directly** into `src/ingress/index.ts`
with no abstraction, which satisfies neither desire well: Slack is welded in, and
a second platform would mean editing the ingress core.

The natural candidate for "someone else's multi-platform adapters" was NanoClaw
(`nanocoai/nanoclaw`), which advertises Slack/Discord/WhatsApp/Telegram/Gmail.
**Investigation (2026-06-06):** NanoClaw's channel integrations are not an
importable adapter library. They are `add-<channel>` **code-generation skills**
(`.claude/skills/add-slack`, `add-discord`, …) that scaffold platform wiring
*into a NanoClaw app running on Anthropic's Agents SDK*. To "use" them you must
be a NanoClaw-shaped app or gut the generated code out of its runtime
assumptions — **the same coupling ADR-0001 already rejected** when it declined
NanoClaw as the orchestrator, now confirmed at the adapter layer.

There is also no strong general-purpose meta-adapter library to lean on (Botkit
is moribund; Bot Framework is heavy and vendor-coupled).

## Options considered

1. **Bolt wired directly (status quo).** Simple, but Slack is non-swappable and a
   second platform edits the core. Fails the "add Discord cheaply" goal.
2. **Adopt NanoClaw and its channel skills.** Gets multi-platform wiring — but
   only by becoming a NanoClaw/Agents-SDK app, re-importing the orchestration
   coupling ADR-0001 rejected. The adapters are not separable from the runtime.
3. **Our own ingress/egress port, filled per-platform by the official SDK.** A
   thin port (`receive → {channel, user, text, thread}` / `send text to thread`);
   each platform's fill is its own official, maintained SDK (`@slack/bolt` now,
   `discord.js` later). NanoClaw's `add-*` skills are kept as **reference recipes**
   for the wiring, not as a dependency.

## Decision

**Option 3.** The human edge is **our port**. Each platform is a thin adapter
behind it, implemented with that platform's **official SDK**:

- `slack` adapter → `@slack/bolt` (now)
- `discord` adapter → `discord.js` (when wanted)
- `file` adapter → replay (CI) / watch (interactive) — the test-mode edge that
  swaps Slack for a bind-mounted file while Redis stays real

The port is the asset; the fills are swappable and individually reliable.
**NanoClaw is reference, not dependency** — its `add-discord` / `add-whatsapp`
skills are recipes for platform wiring, read when building a new adapter.

## Why

- **"Reliable someone-else's component" is satisfied per-edge, not by a
  meta-framework.** Each official SDK *is* the maintained component at its own
  edge; our port unifies them. That is more robust than betting on a single
  multi-platform abstraction layer (none of which is currently good).
- **"Add a platform cheaply" is delivered by the port**, not by adopting
  NanoClaw. Discord later = write a `discord.js` adapter against the existing
  port; the ingress core and everything downstream is untouched.
- **Keeps ADR-0001's rejection intact.** Depending on NanoClaw's adapters would
  smuggle back the Agents-SDK/runtime coupling we already declined. Harvesting
  its skills as recipes captures the know-how without the coupling.
- **The edge is the right thing to mock in tests** (ADR's test architecture):
  an official SDK at a thin edge is exactly the dependency whose correctness is
  guaranteed elsewhere, so stubbing it for layers 1–2 is honest, and the `file`
  adapter is just another fill of the same port.

## Revisit triggers

- A genuinely clean, maintained multi-platform adapter library appears (clean
  event-in/message-out contract, no runtime lock-in) → reconsider adopting it
  instead of per-platform SDKs.
- The per-platform adapters accrete enough shared logic that the port is too thin
  → lift common concerns (formatting, threading) into a shared edge layer —
  without coupling to any one platform.
- We decide to become a NanoClaw/Agents-SDK app for other reasons → this ADR's
  premise changes; revisit.

## Consequences

- **Committed (build):** factor `@slack/bolt` out of `src/ingress/index.ts` behind
  an `Ingress`/`Egress` port; ship `slack` and `file` adapters; select by config
  (`INGRESS_MODE=slack|file`). `discord` is deferred but has a named home.
- **Easy:** add a platform later without touching the ingress core or anything
  downstream of the port.
- **Owned:** we maintain our thin adapters. Mitigated by each sitting directly on
  an official SDK and by NanoClaw's `add-*` skills as wiring references.
- **Watch:** don't let platform-specific concepts (Slack thread semantics, Discord
  guild/channel shapes) leak past the port into Fellow/Forge logic — normalize at
  the adapter.
