# ADR-0001: Event-driven choreography over DAG orchestration

- **Status:** accepted (experimental — v1 in `build/initial-scaffold`; revisit after prior-art research + v1)
- **Date:** 2026-06-06
- **Deciders:** Langdon, Mimir

## Context

The Collegium is the **event-driven realization of the blackboard model** adopted
in AICP `docs/decisions/0001-capability-based-roster.md` (capability-based roster;
AICP = the realm; the control component, "Heimdall," deferred). `pantheon-v1`
already runs that model **by hand**: lenses design, producers build, and the
operator routes every turn.

The felt itch (operator's words): Claude Code is synchronous and single-actor, so
he "can't leave them to collectively noodle on a problem and come up with the
answer including the artifacts" without being completely engaged. The goal is to
let topic-scoped expert personas deliberate **with each other** and dispatch
artifact work **without the operator in the loop for every turn.**

## Options considered

1. **DAG / graph orchestration** (LangGraph, AutoGen, CrewAI, OpenAI Swarm).
   Predefined nodes and edges. Tradeoff: assumes the steps are known and pre-wires
   who-talks-to-whom — the wrong shape for open-ended deliberation.
2. **Adopt an existing framework** (Salesforce SlackAgents; NanoClaw/OpenClaw).
   Tradeoff: SlackAgents is academic-OSS (paper artifact, thin contributor base);
   NanoClaw is a request/response gateway, not a topology — you'd gut its
   orchestrator. Shoehorning either fights its design.
3. **DIY event-driven choreography** on a message bus (Redis Streams), Slack as
   substrate. Personas are independent subscribers that contribute on relevance;
   no central planner. Tradeoff: you own the bus, activation, and (eventually) a
   control component.

## Decision

**Option 3.** Slack ingress → Redis Streams per channel (topic = tenant) → Fellows
subscribe, deliberate, and emit Commissions → a decoupled Foundry fulfills them. No
DAG, no central planner. Multi-tenancy via `channel_id`-as-topic. Personas are
config (a manifest + mounted markdown), reusing `pantheon-v1`.

## Why

- The itch is **open-ended deliberation**, and a DAG models a known pipeline — the
  wrong shape. Choreography (state changes; agents decide who speaks) fits;
  orchestration doesn't.
- This is **not novel and must not be sold as such.** It is the blackboard pattern
  (HEARSAY-II, 1976), the Contract Net Protocol (Smith, 1980) for the commission
  half, and the SOA-era orchestration-vs-choreography debate. Claiming the lineage
  is stronger — and far more defensible to a skeptical senior engineer — than
  claiming invention. *(Prior-art deep research pending; it informs positioning,
  not this decision.)*
- **Reuses `pantheon-v1`** personas and skills → this is automation of an existing
  manual workflow, not greenfield. Strong own-itch.
- Decoupling deliberation from execution keeps heavy/dangerous tooling isolated and
  swappable.

## Revisit triggers

- Prior-art research surfaces a mature event-driven/blackboard **LLM** framework
  that does this well → reconsider DIY vs adopt.
- In practice the operator still drives every turn (deliberation doesn't relieve
  the babysitting) → the itch isn't served; reconsider.
- A given collegium's work turns out to be a **known, repeatable pipeline** → a DAG
  may be correct *for that collegium*. Choreography and orchestration can coexist.
- Control component (the **Provost** = Heimdall at collegium scope): build when
  Fellows stampede or quality demands arbitration — mirrors AICP-0001's Heimdall
  tripwire. Deferred in v1; seam left in place.

## Consequences

- **Easy:** add/remove a Fellow without touching others (the blackboard property);
  multi-topic by config.
- **Hard / committed:** must own activation, durable consumption, and **loop safety
  — a circuit breaker is mandatory** once Fellows hear each other, because runaway
  loops through Pro-account proxies can get the upstream accounts flagged for
  abuse. Eventually a Provost.
- **Naming reconciliation:** AICP-0001 still uses gods/dwarves/Pantheon/Forge; the
  Collegium rename (Fellows/Foundry/Forge/Commission) supersedes that vocabulary
  for this project. See the rename essay in the project docs.
