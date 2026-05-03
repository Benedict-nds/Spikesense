#!/usr/bin/env bash
# Sync Spike mascot PNGs into Android drawable-nodpi (no DPI scaling).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/images/spike"
DST="$ROOT/android/app/src/main/res/drawable-nodpi"
mkdir -p "$DST"
cp "$SRC/spike-calm.png" "$DST/spike_calm.png"
cp "$SRC/spike-concerned.png" "$DST/spike_concerned.png"
cp "$SRC/spike-focused.png" "$DST/spike_focused.png"
cp "$SRC/spike-motivated.png" "$DST/spike_motivated.png"
cp "$SRC/spike-celebrating.png" "$DST/spike_celebrating.png"
cp "$SRC/spike-sleepy.png" "$DST/spike_sleepy.png"
echo "Synced Spike assets to $DST"
