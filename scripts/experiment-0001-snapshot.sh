#!/usr/bin/env bash
set -euo pipefail

snapshot_root="$HOME/.local/state/buzz-experiment-0001"
snapshot_file="$snapshot_root/pre-install-snapshot.txt"
mkdir -p "$snapshot_root"

{
  echo "snapshot_schema=1"
  echo "purpose=Experiment_0001_preinstall_configuration_boundary"
  echo "captured_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for location in "$HOME/.config/xyz.block.buzz.app" "$HOME/.local/share/xyz.block.buzz.app" "$HOME/.local/bin/buzz"; do
    if [ -e "$location" ]; then
      echo "present=$(basename "$location")"
    else
      echo "absent=$(basename "$location")"
    fi
  done
  if [ -x "$HOME/.local/opt/buzz-experiment-0001/Buzz_0.5.11_amd64.AppImage" ]; then
    sha256sum "$HOME/.local/opt/buzz-experiment-0001/Buzz_0.5.11_amd64.AppImage"
  fi
} > "$snapshot_file"

echo "Wrote redacted snapshot to $snapshot_file"
