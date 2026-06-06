# ADR-0003: Leave control and cost seams in v1; defer the mechanisms

- **Status:** accepted (v1 directive)
- **Date:** 2026-06-06
- **Deciders:** Langdon, Mimir
- **Informed by:** `docs/research/prior-art-report.md` ("Lessons this design will re-encounter")

## Context

The prior-art research confirmed ADR-0001's positioning (the architecture is a
recombination of blackboard + contract-net + service-choreography, not novel) and,
more usefully, handed over a risk register written by fifty years of systems that
hit these walls first. Five recurring failure modes: **control leakage, focus /
starvation, feedback loops / hanging states, coherence under weak semantics, cost
growth.**

ADR-0001 already committed to the loop-safety mechanism (circuit breaker) and
deferred the control component (the **Provost** = Heimdall at collegium scope).
This ADR closes the two invariants ADR-0001 left *unpriced* — **focus/starvation**
and **cost growth** — by deciding what v1 must do about them.

The decision is **not** "build the Provost now." It is: **leave a named seam** —
an insertion point where the deferred mechanism plugs in later without rewriting the
Fellow loop — and add only the one cheap thing whose absence would blind us.

A review of the v1 scaffold (`build/initial-scaffold`) found Codex already built
most of the junction boxes:

- **Loop safety (ADR-0001):** substantially honored — `turnCap` + depth notice,
  per-thread lock (`acquireThreadLock`), and answered-set dedup in
  `src/fellow/persona-worker.ts`. Recorded here so it is not re-litigated.
- **Focus/starvation seam — exists but local.** `decideFellowTurn()` in
  `src/fellow/arbitration.ts` is the single activation chokepoint (good). But it is
  a pure function over **one Fellow's** inputs; it cannot see that N other Fellows
  also matched the same message and are all about to fire an LLM call. The
  cross-Fellow / budget view — the Provost-shaped hole — has no socket yet.
- **Cost-growth seam — half-built, half-blind.** `loadThreadHistory()`
  (`.slice(-50)`) is a clean single junction box for future windowing /
  summarization / pruning. But `generateFellowResponse()` in `src/shared/llm.ts`
  discards `completion.usage` — there is **no token-cost signal anywhere**, and the
  `-50` window is a magic number with no metric behind it.

## Options considered

1. **Build the control mechanisms now** (global arbiter, cost governor in v1).
   Tradeoff: premature — we have no live traffic to tune against, and ADR-0001
   deliberately deferred the Provost until Fellows actually stampede.
2. **Ignore them until they hurt.** Tradeoff: the report's whole point is these are
   *invariants*, not maybes; and if the activation/context logic scatters inline,
   retrofitting control later means surgery across every Fellow.
3. **Leave seams + add the one cheap measurement.** Keep every activation flowing
   through `decideFellowTurn`; keep every context read flowing through
   `loadThreadHistory`; emit per-activation token usage now so the cost signal
   exists before we need to act on it. Build no governor, no global arbiter yet.

## Decision

**Option 3.** Two seams, one v1 change, two deferred mechanisms.

**Seam 1 — global activation (focus/starvation).** All activation decisions stay
behind `decideFellowTurn`. To make the seam *usable* later, the gate must be able to
consult shared state — i.e. its signature/wiring should not foreclose passing a
Redis handle or a shared "recent-activations" view. v1 keeps the body trivial
(keyword match). The Provost plugs in **here**, not by editing each Fellow.

**Seam 2 — context assembly (cost growth).** All context reads stay behind
`loadThreadHistory`. Windowing, summarization, snapshotting, and pruning plug in
**here** later. v1 keeps the body trivial (`.slice(-50)`).

**v1 change (the one cheap thing):** `generateFellowResponse` must surface
`completion.usage` (prompt/completion/total tokens), and the Fellow loop must log it
per activation. *You cannot prune what you never measured.* This is the only new
build this ADR mandates for v1.

## Why

- **Seams are cheap; retrofits are surgery.** A stubbed junction box in the wall vs.
  plastering over it — same wall today, five-minute job vs. drywall demolition in six
  months. Naming the two chokepoints now is the difference.
- **The mechanisms are genuinely premature.** No live traffic to tune a budget or a
  Provost against. ADR-0001's Provost tripwire ("build when Fellows stampede") still
  governs *when*; this ADR governs *where it plugs in*.
- **Cost is the one thing you go blind on by default.** The other four failure modes
  announce themselves (loops hang, threads stall). Token cost silently compounds and
  is invisible without `usage` — so it is the single measurement worth taking on day
  one, and it is ~5 lines.
- **This is the publishable spine.** The report's "lessons" section + a v1 that
  *measured* where control and cost actually bit is exactly the honest, lineage-first
  essay (HEARSAY-II's hypothesis explosion = your token bill; BB1's control
  blackboard = your deferred Provost). Seams + metrics are what make the eventual
  write-up evidence-backed rather than vibes.

## Revisit triggers

- **Stampede:** multiple Fellows firing on the same message inflates cost or noise →
  widen Seam 1 into a real global arbiter (the Provost). Mirrors ADR-0001's tripwire.
- **Cost signal trends up:** per-activation token logs show context cost growing with
  thread depth → activate Seam 2 (summarize/window/prune `loadThreadHistory`).
- **`.slice(-50)` proves wrong:** either truncating useful context or already too
  expensive → the metric tells you which way to move the window.

## Consequences

- **Easy / preserved:** the two chokepoints already exist; this ADR mostly *names and
  protects* them so future work plugs in rather than scattering logic.
- **Committed (v1):** plumb `completion.usage` through `generateFellowResponse` and
  log per-activation token cost. Keep `decideFellowTurn` able to reach shared state.
- **Deferred (with sockets left in place):** the Provost / global activation arbiter
  (Seam 1) and context compression (Seam 2). Neither is built in v1; both have a
  named home.
- **Watch:** do not let a future Fellow bypass `decideFellowTurn` or read history
  outside `loadThreadHistory` — that re-scatters the logic and closes the seams.
