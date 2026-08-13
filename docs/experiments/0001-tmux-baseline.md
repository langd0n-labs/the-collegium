# Experiment 0001 tmux baseline

Captured 2026-08-13 without reading pane content.

The observed baseline host had two attached tmux sessions, six active panes,
and three active agent-runner panes. Coordinating the reference scoped request
required a pane check before each send, two manual relays, one delivery retry
(a second explicit Enter), and at least one manual poll to discover completion.
It required checking three sources to reconstruct the work state: the
requesting session, the capability-owning session, and the relay session.

This is a deliberately small, public-safe baseline. The Buzz run must record
the same measurements, plus the number of human authority actions and the
number of GitHub Issues per valid ratification. A lower number is not a pass if
it hides signer identity, delivery failure, or outcome acceptance.
