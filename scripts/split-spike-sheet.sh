#!/usr/bin/env bash
# Split assets/images/spikemascot.png (1536×1024, 3×2 grid) into assets/images/spike/*.png
# Requires macOS `sips`. Bottom-left cell uses Y offset 511 instead of 512 (sips quirk).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/images/spikemascot.png"
OUT="$ROOT/assets/images/spike"
mkdir -p "$OUT"

# sips --cropOffset is (vertical Y, horizontal X) from top-left. -c is (height, width) of crop.
sips -c 512 512 --cropOffset 0 0 "$SRC" -o "$OUT/spike-calm.png"
sips -c 512 512 --cropOffset 0 512 "$SRC" -o "$OUT/spike-concerned.png"
sips -c 512 512 --cropOffset 0 1024 "$SRC" -o "$OUT/spike-focused.png"
sips -c 512 512 --cropOffset 511 0 "$SRC" -o "$OUT/spike-motivated.png"
sips -c 512 512 --cropOffset 512 512 "$SRC" -o "$OUT/spike-celebrating.png"
sips -c 512 512 --cropOffset 512 1024 "$SRC" -o "$OUT/spike-sleepy.png"

echo "Wrote 6 sprites to $OUT"
