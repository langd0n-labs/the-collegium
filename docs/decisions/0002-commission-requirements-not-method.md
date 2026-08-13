# ADR-0002: A Commission declares requirements, not method

- **Status:** accepted
- **Date:** 2026-06-06
- **Deciders:** Langdon, Mimir

## Context

When a Fellow decides work should be produced, what does it hand the Foundry? An
early framing had the Fellow emit something close to `pantheon-v1`'s `build-*.md` —
a full implementation prompt (equip these conventions, run these steps). That puts
the expert in charge of *how* the artifact is made, which is the Foundry's job, not
the Fellow's.

## Options considered

1. **Commission carries implementation** (a build script / detailed method).
   Tradeoff: couples the Fellow to one production method; the Forge becomes a dumb
   runner; swapping the Forge (a human, a different tool, another LLM) breaks the
   commission.
2. **Commission carries requirements + acceptance criteria only;** the Forge owns
   method. Tradeoff: Forges must interpret requirements and self-direct — a more
   capable executor.

## Decision

**Option 2.** A Commission is declarative: the *what* and *why* (e.g., "a printable
practice exam covering joins, 8–10 questions, answer key included") plus acceptance
criteria — **never the *how***. The Forge owns method and loads its own skill
(capability doc) to fulfill it.

## Why

- **Consulting analogy** (operator's framing): the expert states requirements; the
  shop meets them; you don't care how.
- This is the **Contract Net Protocol** (Smith, 1980): the manager announces a task
  by what's needed; the contractor owns execution. The naming already converged
  here — "commission" was chosen because a patron commissions an artist (an
  agreement among equals), and the abstraction survives whoever fulfills it.
- **Forge swappability** is the payoff: a human editor, a PDF Forge, or another
  system can fulfill the same commission unchanged.
- Cleanly splits `pantheon-v1`'s `build-*.md`: its requirements half → **Commission**
  (instance); its conventions half → **Forge skill** (capability, mounted).

## Revisit triggers

- Forges can't reliably meet requirements without method hints → consider a richer
  commission schema (constraints/hints) **without** sliding back to full method.
- Acceptance-criteria checking proves too weak to trust artifacts → add a
  verification step (a Forge, or a Fellow review of the artifact).

## Consequences

- **Easy:** swap/extend Forges without touching Fellows; commissions outlive any
  one production method.
- **Hard / committed:** Forges must interpret intent (smarter executor); need an
  acceptance-criteria convention and a commission schema (artifact type +
  requirements + acceptance criteria).
