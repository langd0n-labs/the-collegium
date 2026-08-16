# ADR-0007: Test Buzz deliberation with a native-work Commission adapter

- **Status:** accepted (bounded experiment)
- **Date:** 2026-08-13
- **Deciders:** operator, Mimir
- **Depends on:** ADR-0006

## Context

The current Collegium design and scaffold use one transport path for several
different institutional acts: Fellows deliberate, arbitrary Fellow output may
contain a `COMMISSION:` marker, and the marker is placed directly on a Forge
queue. ADR-0006 separates those acts: a named synthesizer presents a completed
recommendation, a human ratifies it, and only then does a Commission exist.

Block's Buzz is a plausible deliberation and identity substrate. GitHub Issues
already serve as durable, scoped work records for code in this repository. They
are not competing universal buses: Buzz may be suitable for discussion and for
recording a signed human ratification event, while GitHub remains authoritative
for implementation state.

The goal is to test that composition against a real repository need without
adopting Buzz as production infrastructure, replacing GitHub, or building a
general integration platform. The experiment also produces evidence for a
public follow-up to the architectural claim that multi-agent systems need an
explicit boundary where conversation becomes commitment.

## Options considered

1. **Replace GitHub Issues with Buzz.** Tests a migration rather than the missing
   authority boundary and asks an immature product to become the work system.
2. **Keep all coordination in GitHub Issues.** Preserves durable work but does
   not test live multi-Fellow deliberation, synthesis, or signed ratification.
3. **Compose Buzz and GitHub through a narrow Commission adapter.** Buzz carries
   deliberation and records ratification; a valid human ratification creates one
   GitHub Issue; GitHub owns execution state.
4. **Build a custom bus before testing.** Repeats infrastructure Buzz already
   provides and delays learning whether the institutional protocol is useful.

## Decision

**Option 3, as a bounded experiment.** Use a private Buzz community containing
only non-sensitive, publishable project material. Two Fellows deliberate, a
named experimental synthesizer presents a Commission recommendation, and a
human ratifier may approve, reject, or return it.

For the first run:

- Buzz is authoritative for the deliberation transcript, recommendation, and
  signed record of the human ratification event. The human holds ratification
  authority.
- A Commission exists only after a valid human ratification under ADR-0006.
- A minimal bridge maps that Commission to one GitHub Issue in this repository.
- GitHub is authoritative for implementation status after Issue creation.
- The existing Issue -> worktree -> branch -> PR workflow acts as the Forge
  execution path.
- The Forge returns one refusal, blocked, or completion signal with evidence to
  the originating Buzz thread.
- The human acceptance authority accepts the result or reopens the Commission.

The first Commission will request this real repository change:

> Add a typed Commission-recommendation and human-ratification lifecycle to the
> file-mode scaffold. Raw Fellow output must not enqueue Forge work. Only an
> attributable, authorized, idempotent ratification may create a Commission;
> rejection and return-to-deliberation must create none.

The experiment must create the Issue after ratification. Creating it manually in
advance would invalidate the central test.

The initial ratification interface is an explicit signed message referencing the
recommendation event:

```text
RATIFY <recommendation-event-id>
REJECT <recommendation-event-id>
RETURN <recommendation-event-id> <reason>
```

Do not depend on Buzz workflow approval gates for the first run. Do not use an
ambiguous reaction as authority.

The Commission ID is derived from the valid ratification event. The bridge may
retain a minimal delivery outbox mapping `commission_id` to `github_issue_url`
for idempotency. It must not retain or reconcile work status; that remains in
GitHub.

## Why

- **It exercises a real own itch.** The raw `COMMISSION:` interceptor directly
  contradicts the newly accepted authority lifecycle and needs correction.
- **It isolates the architectural question.** Human ratification and one
  adapter are tested before autonomous launch, general synchronization, or
  self-hosted relay operations.
- **It preserves native authority.** Buzz need not become an issue tracker, and
  GitHub need not become a deliberation room.
- **It is falsifiable.** Unauthorized or duplicate Issue creation, invisible
  delivery failure, or contradictory status disproves the composition.
- **It bootstraps honestly.** A manual or disposable bridge commissions the code
  that may later make recommendation and ratification native to the scaffold.

Revisit the composition if Buzz cannot provide reliable attributable delivery;
the bridge requires a parallel work-state database; the operator must inspect
both systems to learn current status; GitHub semantics distort the Commission
contract; or the interaction costs more attention than the current guarded tmux
relay baseline.

## Consequences

- Installation and hosted-service evaluation must be isolated, pinned, and
  preceded by a host-configuration snapshot.
- The experiment uses public-safe material only; private design-input notes must
  not be copied into Buzz or GitHub.
- The bridge is disposable experiment infrastructure, not a production service.
- Automated Forge launch, bidirectional status synchronization, self-hosting,
  mobile use, generalized adapter interfaces, and autonomous ratification remain
  out of scope.
- The current `build/initial-scaffold` work must be made durable and its open PR
  state reconciled before the commissioned implementation begins.
- Findings, including failure paths, will be recorded under `docs/experiments/`.
