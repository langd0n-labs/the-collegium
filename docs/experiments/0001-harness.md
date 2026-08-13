# Experiment 0001 harness boundary

This disposable harness prepares the Buzz-to-GitHub delivery boundary. It is
not the selected Commission implementation and must not create that Issue.

## Pinned components

- Buzz desktop: `desktop-v0.5.11`, source revision
  `248b9d1b7666aacbcb1485b76e81de30a271ba0e`
- Buzz CLI and relay/API: to be built only from the same immutable source
  revision; no rolling image tag is permitted. The public container registry
  does not expose a matching immutable artifact tag without package-metadata
  access, so neither component is installed yet.
- Participant runners: two separately named, one-turn, local Codex runners at
  an explicitly recorded model/version; managed Buzz ACP runners are excluded
  because they can expose an agent signing key to model-controlled subprocesses.

The local snapshot records only presence/absence and a desktop checksum. It
never records a private key, relay address, identity, or host-specific detail.

## Bridge contract

`CommissionBridge` consumes a verified recommendation and an explicit signed
human action. Signature verification is an injected boundary, not a field the
event is allowed to assert about itself. `RETURN`, `REJECT`, missing
recommendations, bad signatures, and the wrong signer create neither outbox
record nor Issue. On `RATIFY`, it writes the outbox before calling GitHub, uses
the deterministic Commission ID to find an earlier external result after a
restart, and writes the Issue body to a file.

The outbox contains only a Commission-ID key and a pending marker or eventual
GitHub Issue URL. It does not copy GitHub status or retain recommendation
state. Buzz remains the source for deliberation and ratification; GitHub owns
implementation status after delivery.

## Containment and rollback

- Desktop is stored in an experiment-specific application directory and is not
  placed on `PATH`.
- All runtime output is under the ignored `.experiment/` directory or the
  platform-local experiment state directory.
- No ACP harness, provider, relay, or desktop instance is launched until the
  private hosted community and test identity path have been verified.
- Rollback consists of removing the experiment-specific application and local
  state directories; no shared agent configuration is modified.
