# Experiment 0001: Buzz deliberation to a GitHub-backed Commission

- **Status:** planned
- **Date:** 2026-08-13
- **Decision:** ADR-0007
- **Primary hypothesis:** Buzz can host deliberation and record explicit human
  ratification while GitHub remains the sole authoritative work record, reducing
  manual relay work without creating duplicate state. The human, not Buzz, holds
  ratification authority.

## What this experiment is not

This is not a Buzz migration, a production deployment, a self-hosting exercise,
or a benchmark of model quality. It does not attempt to prove that GitHub Issues
are the universal representation of work. It tests one composition for one kind
of repository-scoped work.

## Baseline

Use the current guarded tmux relay as the comparison path. Record:

- pane checks needed before sending;
- manual relays between specialist sessions;
- delivery retries or second-Enter events;
- manual polls needed to discover completion;
- source switches needed to determine current state; and
- operator interventions between initial request and accepted result.

The experiment succeeds only if it improves on coordination load without hiding
authority or failure.

## Selected test work

### Commission recommendation

**Working title:** Add a recommendation and ratification lifecycle to the
file-mode Collegium loop

**Requested outcome:** Replace the scaffold's direct path from raw Fellow
`COMMISSION:` output to the Forge queue with typed recommendation,
ratification, Commission, and acceptance states consistent with ADR-0006.

**Requirements:**

- Fellow contributions remain ordinary deliberation messages.
- A designated synthesizer can emit a typed Commission recommendation containing
  outcome, reasons, dissent or uncertainty, requirements, acceptance criteria,
  risk/cost/reversibility, and requested ratifier.
- A recommendation is visible to the human and cannot reach a Forge queue.
- Only a configured human identity may ratify during this experiment.
- Ratify, reject, and return-to-deliberation are distinct transitions.
- A valid ratification creates and enqueues exactly one Commission.
- Rejection, return, malformed input, an unauthorized identity, and replay do not
  create a Commission.
- Forge refusal, execution reported, outcome accepted, and outcome reopened
  remain distinguishable.
- The initial implementation is exercised through the existing file adapter and
  real Redis integration harness; it does not require Slack or Buzz at runtime.

**Acceptance criteria:**

1. Unit tests cover recommendation parsing/validation and every authority
   transition.
2. An integration test proves that deliberation and recommendation produce no
   Forge artifact before ratification.
3. An authorized ratification produces one Commission and one artifact.
4. Replaying the same ratification produces no second Commission or artifact.
5. Unauthorized ratification, rejection, and return produce no artifact and an
   observable result.
6. Forge completion does not automatically mark the outcome accepted.
7. Existing file-mode deliberation and Slack adapter behavior remain intact.
8. Documentation no longer instructs Fellows to create executable work through
   an arbitrary `COMMISSION:` marker.

### Why this work

It is the first real implementation gap created by ADR-0006, has an observable
current failure mode, belongs naturally in this repository, and can be completed
through the existing Issue/worktree/PR workflow. It tests the architecture rather
than manufacturing an unrelated demo task.

Do **not** create the GitHub Issue in advance. The experiment bridge must create
it as the effect of valid ratification.

## Roles

- **Architecture Fellow:** pressure-tests boundaries, event ownership, and
  idempotency.
- **Reliability/Governance Fellow:** pressure-tests authorization, failure,
  recovery, and auditability.
- **Rapporteur (experimental Synthesizer):** determines when the discussion is
  decision-ready and presents the recommendation. This is a test role, not a
  permanent roster or brand decision.
- **Human ratifier:** approves, rejects, or returns the recommendation.
- **Implementation Forge:** executes the resulting GitHub Issue through the
  existing agent delivery workflow.
- **Human acceptance authority:** accepts the evidence or reopens the Commission.

The Rapporteur does not ratify and is not assumed to be the Provost.

## Prerequisites

1. Reconcile the existing `build/initial-scaffold` branch and PR so the Issue has
   a durable base. Do not absorb unrelated working-tree changes.
2. Pin the Buzz desktop, CLI, relay/API, and agent-harness versions used.
3. Use a private hosted community for the first protocol test; evaluate
   self-hosting only after the protocol passes.
4. Snapshot the agent configuration files and installed command/skill locations
   that Buzz setup could affect.
5. Use only public-safe source material and test identities.
6. Store Buzz identity secrets through the approved secrets path; never place
   them in the repository, command arguments, logs, or transcript.
7. Confirm the GitHub bot identity can create an Issue in this repository without
   using the operator's identity.

## Recommendation shape

The Rapporteur's terminal deliberation message must contain:

```text
type: commission_recommendation
recommendation_id: <Buzz event ID>
recommended_by: <Rapporteur identity>
source_thread: <Buzz thread/channel reference>
outcome: <what should happen>
reasons:
  - <reason>
dissent_or_uncertainty:
  - <material dissent or none>
requirements:
  - <requirement>
acceptance_criteria:
  - <criterion>
risk: <summary>
cost: <summary>
reversibility: <summary>
requested_ratifier: <human public key>
```

The message must say plainly that deliberation is finished and ask whether the
recommendation should become a Commission.

## Ratification and bridge behavior

The human responds with one explicit signed command referencing the recommendation
event ID:

```text
RATIFY <recommendation-event-id>
REJECT <recommendation-event-id>
RETURN <recommendation-event-id> <reason>
```

The bridge must:

1. verify the referenced recommendation exists and is awaiting ratification;
2. verify the signer is the requested ratifier;
3. reject terminal or previously consumed recommendations;
4. derive the Commission ID from the valid ratification event;
5. write an outbox record before attempting the external side effect;
6. create one GitHub Issue from the recommendation using a file-backed body;
7. persist only `commission_id -> github_issue_url` as delivery state; and
8. post the Commission ID and Issue URL back to the Buzz thread.

The Issue body must preserve:

```text
Commission-ID
Recommendation event
Ratification event
Recommended by
Ratified by
Authority basis
Requested outcome
Requirements
Acceptance criteria
Acceptance authority
Source thread
```

After creation, GitHub owns implementation status. The bridge must not mirror
labels, assignees, PR state, or completion into a second database.

## Run sequence

1. Capture the pre-install host/configuration snapshot.
2. Create the private Buzz community and participant identities.
3. Give both Fellows the same public-safe implementation problem and ADRs.
4. Have each Fellow produce an independent first read before cross-review.
5. Allow visible deliberation and disagreement in one Buzz thread.
6. Have the Rapporteur present the decision-ready recommendation.
7. Exercise one `RETURN` path and confirm that no Issue exists.
8. Continue deliberation and produce a revised recommendation.
9. Ratify the revised recommendation with the configured human identity.
10. Verify that the bridge creates exactly one GitHub Issue.
11. Replay the ratification event and restart the bridge; verify no duplicate.
12. Launch the Implementation Forge through the normal Issue workflow.
13. Have the Forge post refusal, blocked, or completion evidence to both the Issue
    and the originating Buzz thread.
14. Accept the result or reopen the Commission based on its acceptance criteria.
15. Compare the run with the tmux baseline and record findings.

## Required failure drills

- Recommendation without ratification: no Issue.
- Ratification by the wrong identity: rejected visibly, no Issue.
- Return to deliberation: no Issue; revised recommendation gets a new ID.
- Bridge restart after external creation: no duplicate Issue.
- Fellow or Rapporteur offline: missed work is visible and recoverable or the
  experiment fails.
- Forge refuses the Commission: refusal is recorded; no false completion.
- Forge reports execution but acceptance fails: Commission remains open or is
  reopened.

## Measurements

Record exact counts for:

- human ratification/acceptance actions;
- manual relays and manual source polls;
- delivery retries and duplicate events;
- Issues created per ratified Commission;
- unauthorized transitions rejected;
- systems inspected to answer "what is the current work state?";
- time from request to recommendation, ratification, Issue creation, execution
  report, and acceptance; and
- configuration or filesystem changes made by Buzz installation and execution.

## Pass criteria

- No GitHub Issue exists before valid ratification.
- Exactly one Issue exists afterward, including complete provenance and
  acceptance criteria.
- GitHub alone answers the implementation-status question.
- Buzz carries deliberation, authority transitions, links, and meaningful
  terminal signals without becoming a second task board.
- Delivery failures are visible; no participant waits indefinitely without a
  detectable reason.
- The Forge may refuse or fail without the system claiming completion.
- Execution and outcome acceptance remain distinct.
- The operator performs fewer manual relays and source checks than in the tmux
  baseline.

## Stop conditions

Stop rather than patch forward if:

- setup writes broad agent configuration without a contained opt-out or reliable
  rollback;
- a participant's identity or authority cannot be verified;
- the bridge needs a full parallel work-state database;
- duplicate Issue creation cannot be prevented;
- private source material would have to leave its approved boundary; or
- fixing Buzz becomes more work than testing the Commission boundary.

## Evidence report

The findings report must include:

- pinned versions and configuration boundary;
- baseline and experimental measurements;
- event and Issue/PR references safe for public disclosure;
- every failure drill and its result;
- host-side effects;
- what was learned about synthesis, ratification, idempotency, status ownership,
  Forge refusal, and outcome acceptance;
- whether to adopt, re-test, replace, or abandon each component; and
- the narrowest next experiment, if any.

Do not generalize from one successful run to all work types. The result applies
first to public, repository-scoped software work.
