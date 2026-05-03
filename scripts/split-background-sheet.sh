#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/assets/images/wertz1.png"
OUT_DIR="${ROOT}/assets/images/backgrounds"
mkdir -p "$OUT_DIR"

if [[ ! -f "$SRC" ]]; then
  echo "[BG_SPLIT] ERROR: missing source: $SRC" >&2
  exit 1
fi

echo "[BG_SPLIT] source=$SRC"

W=$(sips -g pixelWidth "$SRC" 2>/dev/null | awk '/pixelWidth:/ {print $2}')
H=$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight:/ {print $2}')

if [[ -z "${W:-}" || -z "${H:-}" ]]; then
  echo "[BG_SPLIT] ERROR: could not read dimensions" >&2
  exit 1
fi

echo "[BG_SPLIT] width=$W height=$H"

cols=5
rows=2
CELL_W=$((W / cols))
CELL_H=$((H / rows))

echo "[BG_SPLIT] cols=$cols rows=$rows cellWidth=$CELL_W cellHeight=$CELL_H"

read_dims() {
  local f="$1"
  local ow oh
  ow=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth:/ {print $2}')
  oh=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight:/ {print $2}')
  echo "$ow $oh"
}

verify_cell_crop() {
  local dest="$1"
  local ow oh
  read -r ow oh <<<"$(read_dims "$dest")"
  echo "[BG_SPLIT][VERIFY] file=$dest width=$ow height=$oh"
  if [[ -z "$ow" || -z "$oh" ]]; then
    echo "[BG_SPLIT][ERROR] could_not_read_output_dimensions file=$dest" >&2
    exit 1
  fi
  if [[ "$ow" -eq "$W" && "$oh" -eq "$H" ]]; then
    echo "[BG_SPLIT][ERROR] crop_failed_full_sheet_detected file=$dest width=$ow height=$H" >&2
    exit 1
  fi
  if [[ "$ow" -ne "$CELL_W" || "$oh" -ne "$CELL_H" ]]; then
    echo "[BG_SPLIT][WARN] unexpected_cell_dimensions file=$dest expected=${CELL_W}x${CELL_H} got=${ow}x${oh}" >&2
  fi
}

NAMES=(
  "bg-balance-thrive.png"
  "bg-small-choices.png"
  "bg-awareness-brain.png"
  "bg-less-overload.png"
  "bg-focus-freedom.png"
  "bg-track-patterns.png"
  "bg-every-minute.png"
  "bg-phone-balanced.png"
  "bg-progress-not-perfection.png"
  "bg-rest-reset.png"
)

idx=0
for row in 0 1; do
  for col in 0 1 2 3 4; do
    X=$((col * CELL_W))
    Y=$((row * CELL_H))
    name="${NAMES[$idx]}"
    dest="${OUT_DIR}/${name}"
    sips --cropToHeightWidth "$CELL_H" "$CELL_W" --cropOffset "$X" "$Y" "$SRC" --out "$dest" >/dev/null
    echo "[BG_SPLIT] wrote=$dest (${CELL_W}x${CELL_H} @ ${X},${Y})"
    verify_cell_crop "$dest"
    idx=$((idx + 1))
  done
done

# Insights / default tab: single portrait cell only (never copy full wertz.png / cluster sheet).
# Row 0 col 0 = balance-thrive cell (unique vs overview col2 / progress row1 / achievements col4).
AI_COL=0
AI_ROW=0
X_AI=$((AI_COL * CELL_W))
Y_AI=$((AI_ROW * CELL_H))
DASH_DEST="${OUT_DIR}/bg-ai-dashboard.png"
sips --cropToHeightWidth "$CELL_H" "$CELL_W" --cropOffset "$X_AI" "$Y_AI" "$SRC" --out "$DASH_DEST" >/dev/null
echo "[BG_SPLIT] wrote=$DASH_DEST (${CELL_W}x${CELL_H} @ ${X_AI},${Y_AI}) (single-cell, insights)"
verify_cell_crop "$DASH_DEST"

echo "[BG_SPLIT] done"
