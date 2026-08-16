# ADR-0006: A human ratifies Commission recommendations near-term

- **Status:** accepted
- **Date:** 2026-08-13
- **Deciders:** operator, Mimir
- **Amends:** ADR-0001 and the brand-guide shorthand that a Fellow directly
  commissions work

## Context

The existing design separates deliberation by Fellows from execution by Forges,
but it collapses two different acts into the phrase "a Fellow issues a
Commission":

1. participants reaching a reasoned recommendation; and
2. an authorized actor turning that recommendation into durable work.

That ambiguity matters. A Fellow may contribute a position at the beginning of a
debate, while the system also needs an explicit end-of-deliberation handoff that
says, in effect: "we have finished; this is what we recommend should happen."
Neither a contribution nor convergence by itself creates authority to spend
money, change systems, contact people, or otherwise obligate the operator.

The goal is a governable path from open-ended deliberation to artifact-producing
work. The added lifecycle is primarily a product and safety requirement; the
bounded Buzz-plus-native-work-system experiment will also test and document it as
a learning and publishing outcome.

## Options considered

1. **Any Fellow may create a Commission directly.** Minimal machinery, but it
   conflates speech with authority and makes an ordinary contribution capable of
   creating an obligation.
2. **A named agent both synthesizes and ratifies.** Preserves an agent-driven
   flow, but grants authority before the system has earned it through bounded,
   observable operation.
3. **A named synthesizer recommends; a human ratifies near-term.** Keeps the
   explicit named-agent handoff while reserving the creation of consequential
   work to a human until narrower authority can be delegated safely.

## Decision

**Option 3.** Fellows deliberate and contribute positions. A designated,
named synthesizer determines that the deliberation is ready for a decision and
presents a **Commission recommendation** to the human authority.

The handoff must be explicit and recognizable as the end of deliberation, not
another conversational proposal. It must communicate:

- the recommended outcome;
- the reasons for it;
- material dissent or unresolved uncertainty;
- proposed requirements and acceptance criteria;
- relevant risk, cost, and reversibility; and
- the identity of the requested ratifier.

The human may ratify, reject, or return the recommendation for further
deliberation. **A Commission exists only after ratification.** Ratification turns
the recommendation into a durable work contract; a Forge may then accept or
refuse it and choose how to fulfill it under ADR-0002.

The lifecycle is:

```text
deliberating
    -> recommendation_ready
    -> awaiting_ratification
        -> returned_to_deliberation
        -> rejected
        -> commissioned
            -> accepted_or_refused_by_forge
            -> executing
            -> execution_reported
            -> outcome_accepted_or_reopened
```

The named synthesizer is not automatically the Provost. ADR-0001 and ADR-0003
define the Provost-shaped seam around activation, focus, arbitration, and cost.
Whether one named Fellow eventually owns both synthesis and control is a later
roster decision, not an implication of this ADR.

Commission records must preserve, at minimum, these distinct facts:

```text
recommended_by
ratified_by
authority_basis
requirements
acceptance_criteria
acceptance_authority
```

The near-term `ratified_by` authority is human. Future policy may delegate
ratification for explicitly bounded classes of low-risk, reversible work. Such
delegation must be affirmative and auditable; it is never inferred merely because
an agent synthesized or announced the recommendation.

## Why

- **Conversation is not commitment.** Deliberation may generate options and
  consensus; ratification is the separate act that gives one outcome the force of
  work.
- **The named-agent role remains real.** The synthesizer performs a concrete
  protocol transition and presents the collective recommendation rather than
  merely writing a pleasant summary.
- **Authority stays honest.** The current system has not demonstrated enough
  reliable delivery, policy enforcement, or bounded failure behavior to let an
  agent create consequential obligations autonomously.
- **Execution is not acceptance.** A Forge reporting completion does not prove
  that the commissioned outcome meets its acceptance criteria. The acceptance
  authority remains explicit and may reopen the Commission.
- **Delegation remains possible.** Human ratification is a current policy, not a
  claim that humans must approve every Commission forever.

Revisit human-only ratification when a concrete class of work is low-risk and
reversible; authority bounds can be expressed and enforced; recommendations and
ratifications are attributable and auditable; duplicate delivery is idempotent;
and observed agent decisions match human decisions often enough that human review
adds less value than delay. External communication, spending, destructive
changes, and material commitments remain human-ratified unless separately
decided.

## Consequences

- The protocol needs a first-class recommendation/ratification transition rather
  than treating a `COMMISSION:` marker in arbitrary Fellow output as sufficient
  authority.
- The human interface needs a compact approve, reject, or return-for-deliberation
  action with the recommendation, dissent, requirements, and acceptance criteria
  visible together.
- A native work record such as a GitHub Issue may represent an already-ratified
  Commission, but creating that record must not silently perform ratification.
- The synthesizer identity and selection rule remain open roster questions.
- Ratification authority and outcome-acceptance authority may be the same human
  near-term, but the data model must not collapse them.
- Existing prose saying that Fellows directly commission work is architectural
  shorthand superseded by this lifecycle.
